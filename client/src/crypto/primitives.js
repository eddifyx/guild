/**
 * /guild E2E Encryption — Cryptographic Primitives
 *
 * Thin wrapper over @noble/* libraries. All raw crypto operations are
 * centralized here so the rest of the crypto module never imports
 * @noble directly. This makes auditing straightforward.
 *
 * Libraries used (all audited by Trail of Bits):
 *   @noble/curves  — X25519 ECDH, Ed25519 signatures
 *   @noble/ciphers — AES-256-GCM
 *   @noble/hashes  — HKDF-SHA256, HMAC-SHA256, SHA-256, SHA-512
 */

import { x25519 } from '@noble/curves/ed25519';
import { edwardsToMontgomeryPub, edwardsToMontgomeryPriv } from '@noble/curves/ed25519';
import { ed25519 } from '@noble/curves/ed25519';
import { gcm } from '@noble/ciphers/aes';
import { hkdf } from '@noble/hashes/hkdf';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { concatBytes } from '@noble/hashes/utils';

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate a random X25519 key pair for Diffie-Hellman.
 */
export function generateX25519KeyPair() {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Generate a random Ed25519 key pair for signing.
 */
export function generateEd25519KeyPair() {
  const privateKey = randomBytes(32);
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Generate both X25519 and Ed25519 key pairs from a single 32-byte seed.
 * The Ed25519 pair is the "primary" identity; X25519 pair is derived
 * via birational map for DH operations.
 */
export function generateIdentityKeyPairFromSeed(seed) {
  // Ed25519 signing key pair
  const signingPrivateKey = new Uint8Array(seed);
  const signingPublicKey = ed25519.getPublicKey(signingPrivateKey);

  // X25519 DH key pair (derived from Ed25519 keys via birational map)
  const dhPrivateKey = edwardsToMontgomeryPriv(signingPrivateKey);
  const dhPublicKey = edwardsToMontgomeryPub(signingPublicKey);

  return {
    identityKey: { privateKey: dhPrivateKey, publicKey: dhPublicKey },
    signingKey: { privateKey: signingPrivateKey, publicKey: signingPublicKey },
  };
}

// ---------------------------------------------------------------------------
// Diffie-Hellman
// ---------------------------------------------------------------------------

/**
 * X25519 ECDH shared secret.
 * @param {Uint8Array} privateKey — our X25519 private key (32 bytes)
 * @param {Uint8Array} publicKey  — their X25519 public key (32 bytes)
 * @returns {Uint8Array} shared secret (32 bytes)
 */
export function x25519DH(privateKey, publicKey) {
  return x25519.getSharedSecret(privateKey, publicKey);
}

/**
 * Known small-order X25519 points that produce all-zero shared secrets.
 * Any public key matching one of these MUST be rejected to prevent
 * a MITM from forcing predictable DH outputs.
 * Ref: https://cr.yp.to/ecdh.html#validate
 */
const SMALL_ORDER_POINTS = new Set([
  '0000000000000000000000000000000000000000000000000000000000000000',
  '0100000000000000000000000000000000000000000000000000000000000000',
  'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  'e0eb7a7c3b41b8ae1656e3faf19fc46ada098deb9c32b1fd866205165f49b800',
  '5f9c95bca3508c24b1d0b1559c83ef5b04445cc4581c8e86d8224eddd09f1157',
  '0000000000000000000000000000000000000000000000000000000000000080',
  '0100000000000000000000000000000000000000000000000000000000000080',
  'edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
  'edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
]);

/**
 * Reject known small-order X25519 public keys.
 * @param {Uint8Array} key — 32-byte X25519 public key
 * @param {string} label — description for error messages
 * @throws if the key is a known small-order point
 */
export function rejectSmallOrderPoint(key, label) {
  const hex = toHex(key);
  if (SMALL_ORDER_POINTS.has(hex)) {
    throw new Error(`${label} is a known small-order point`);
  }
}

/**
 * Validate that a DH shared secret is not all-zero (small-order point attack).
 * @param {Uint8Array} dh — DH output to validate
 * @param {string} label — description for error messages
 * @throws if the DH output is all zeros
 */
export function assertNonZeroDH(dh, label) {
  if (dh.every(b => b === 0)) {
    throw new Error(`${label} produced all-zero shared secret`);
  }
}

// ---------------------------------------------------------------------------
// Signatures (Ed25519)
// ---------------------------------------------------------------------------

/**
 * Sign a message with Ed25519.
 * @returns {Uint8Array} signature (64 bytes)
 */
export function ed25519Sign(privateKey, message) {
  return ed25519.sign(message, privateKey);
}

/**
 * Verify an Ed25519 signature.
 * @returns {boolean}
 */
export function ed25519Verify(publicKey, message, signature) {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Symmetric Encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

/**
 * Encrypt with AES-256-GCM.
 * @param {Uint8Array} key       — 32-byte encryption key
 * @param {Uint8Array} plaintext — data to encrypt
 * @param {Uint8Array} [aad]     — optional additional authenticated data
 * @returns {{ ciphertext: Uint8Array, nonce: Uint8Array }}
 */
export function aes256GcmEncrypt(key, plaintext, aad) {
  const nonce = randomBytes(12);
  const cipher = gcm(key, nonce, aad);
  const ciphertext = cipher.encrypt(plaintext);
  return { ciphertext, nonce };
}

/**
 * Decrypt with AES-256-GCM.
 * @param {Uint8Array} key        — 32-byte encryption key
 * @param {Uint8Array} ciphertext — data to decrypt (includes GCM auth tag)
 * @param {Uint8Array} nonce      — 12-byte nonce
 * @param {Uint8Array} [aad]      — optional additional authenticated data
 * @returns {Uint8Array} plaintext
 * @throws on authentication failure
 */
export function aes256GcmDecrypt(key, ciphertext, nonce, aad) {
  const cipher = gcm(key, nonce, aad);
  return cipher.decrypt(ciphertext);
}

// ---------------------------------------------------------------------------
// Key Derivation
// ---------------------------------------------------------------------------

/**
 * HKDF-SHA256: derive key material from input keying material.
 * @param {Uint8Array} ikm    — input keying material
 * @param {Uint8Array} salt   — salt (use 32 zero bytes if none)
 * @param {string|Uint8Array} info — context/application-specific info
 * @param {number} length     — desired output length in bytes
 * @returns {Uint8Array}
 */
export function hkdfSha256(ikm, salt, info, length) {
  return hkdf(sha256, ikm, salt, info, length);
}

/**
 * HMAC-SHA256.
 * @param {Uint8Array} key  — HMAC key
 * @param {Uint8Array} data — data to authenticate
 * @returns {Uint8Array} 32-byte MAC
 */
export function hmacSha256(key, data) {
  return hmac(sha256, key, data);
}

// ---------------------------------------------------------------------------
// Hash Functions
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash.
 * @param {Uint8Array} data
 * @returns {Uint8Array} 32 bytes
 */
export function hashSha256(data) {
  return sha256(data);
}

/**
 * SHA-512 hash.
 * @param {Uint8Array} data
 * @returns {Uint8Array} 64 bytes
 */
export function hashSha512(data) {
  return sha512(data);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Generate cryptographically secure random bytes.
 * Uses Web Crypto API (available in Electron/Chromium).
 * @param {number} n — number of bytes
 * @returns {Uint8Array}
 */
export function randomBytes(n) {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
}

/**
 * Constant-time comparison of two byte arrays.
 * Rejects mismatched lengths immediately — this is safe because all
 * crypto comparisons (HMAC, hashes) have fixed-length outputs, so
 * length mismatch is always an error, not a timing side-channel.
 * @returns {boolean}
 */
export function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Concatenate multiple Uint8Arrays into one.
 */
export { concatBytes };

/**
 * Encode Uint8Array to base64 string.
 */
export function toBase64(bytes) {
  // Chunked conversion to avoid call stack overflow on large Uint8Arrays
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode base64 string to Uint8Array.
 * Validates charset to reject malformed input early.
 */
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
export function fromBase64(str) {
  if (typeof str !== 'string' || str.length === 0) {
    throw new Error('fromBase64: input must be a non-empty string');
  }
  if (!BASE64_RE.test(str)) {
    throw new Error('fromBase64: input contains invalid base64 characters');
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode Uint8Array to hex string.
 */
export function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decode hex string to Uint8Array.
 */
export function fromHex(hex) {
  if (typeof hex !== 'string' || hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
