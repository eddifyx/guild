/**
 * /guild E2E Encryption — Attachment Encryption
 *
 * Files are encrypted client-side with AES-256-GCM before upload.
 * The server stores only ciphertext. The decryption key and integrity
 * digest travel inside the encrypted message payload (never in plaintext).
 *
 * Flow:
 *   1. Client encrypts file → uploads encrypted blob
 *   2. Server returns file URL for the encrypted blob
 *   3. Client includes { serverFileUrl, encryptionKey, digest, metadata }
 *      inside the encrypted message payload
 *   4. Recipient decrypts message → extracts key → fetches blob → decrypts file
 */

import {
  aes256GcmEncrypt,
  aes256GcmDecrypt,
  randomBytes,
  hashSha256,
  constantTimeEqual,
  toBase64,
  fromBase64,
  concatBytes,
} from './primitives.js';
import { getFileUrl } from '../api.js';

/**
 * Encrypt a file for upload.
 *
 * @param {File} file — the file to encrypt
 * @returns {Promise<{
 *   encryptedBlob: Blob,
 *   key: string,          — base64 AES-256 key
 *   digest: string,       — base64 SHA-256 of plaintext
 *   originalName: string,
 *   originalType: string,
 *   originalSize: number,
 * }>}
 */
export async function encryptAttachment(file) {
  // Read file as ArrayBuffer
  const plaintext = new Uint8Array(await file.arrayBuffer());

  // Generate random AES-256 key
  const key = randomBytes(32);

  // Encrypt
  const { ciphertext, nonce } = aes256GcmEncrypt(key, plaintext);

  // Compute integrity digest of the plaintext
  const digest = hashSha256(plaintext);

  // Pack as: nonce (12 bytes) || ciphertext
  const packed = concatBytes(nonce, ciphertext);
  const encryptedBlob = new Blob([packed], { type: 'application/octet-stream' });

  const keyBase64 = toBase64(key);
  const digestBase64 = toBase64(digest);

  // Securely erase key material and plaintext from memory
  key.fill(0);
  plaintext.fill(0);

  return {
    encryptedBlob,
    key: keyBase64,
    digest: digestBase64,
    originalName: file.name,
    originalType: file.type || 'application/octet-stream',
    originalSize: file.size,
  };
}

/**
 * Decrypt an encrypted attachment fetched from the server.
 *
 * @param {string} encryptedUrl — server URL of the encrypted file
 * @param {string} keyBase64 — base64-encoded AES-256 key
 * @param {string} digestBase64 — base64-encoded SHA-256 of original plaintext
 * @param {string} originalType — MIME type of the original file
 * @returns {Promise<Blob>} decrypted file as a Blob
 */
const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024; // 100 MB

export async function decryptAttachment(encryptedUrl, keyBase64, digestBase64, originalType) {
  // Accept already-authenticated absolute URLs without re-appending the token.
  const fullUrl = /^https?:\/\//i.test(encryptedUrl)
    ? encryptedUrl
    : getFileUrl(encryptedUrl);

  const response = await fetch(fullUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch encrypted attachment: ${response.status}`);
  }

  // Check Content-Length before buffering to prevent memory exhaustion
  const contentLength = parseInt(response.headers.get('content-length'), 10);
  if (contentLength > MAX_ATTACHMENT_SIZE) {
    throw new Error(`Encrypted attachment too large (${contentLength} bytes, max ${MAX_ATTACHMENT_SIZE})`);
  }

  const packed = new Uint8Array(await response.arrayBuffer());
  if (packed.length > MAX_ATTACHMENT_SIZE) {
    throw new Error(`Encrypted attachment too large (${packed.length} bytes, max ${MAX_ATTACHMENT_SIZE})`);
  }

  // Unpack: nonce (12 bytes) || ciphertext
  if (packed.length < 12) {
    throw new Error('Encrypted attachment too short');
  }
  const nonce = packed.slice(0, 12);
  const ciphertext = packed.slice(12);

  // Decrypt
  const key = fromBase64(keyBase64);
  const plaintext = aes256GcmDecrypt(key, ciphertext, nonce);

  // Verify integrity (constant-time comparison to prevent timing attacks)
  if (!digestBase64) {
    throw new Error('Attachment integrity check failed: no digest provided');
  }
  const expectedDigest = fromBase64(digestBase64);
  const actualDigest = hashSha256(plaintext);
  if (!constantTimeEqual(expectedDigest, actualDigest)) {
    throw new Error('Attachment integrity check failed: digest mismatch');
  }

  // Securely erase key
  key.fill(0);

  return new Blob([plaintext], { type: originalType || 'application/octet-stream' });
}
