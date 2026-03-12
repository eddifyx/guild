/**
 * /guild E2E Encryption — PreKey Management
 *
 * Manages Signed PreKeys (SPK) and One-Time PreKeys (OTP) for the X3DH protocol.
 *
 * Signed PreKey: medium-term X25519 key pair, signed by the identity's Ed25519 key.
 *   Rotated every ~7 days. Old SPKs kept for a grace period.
 *
 * One-Time PreKeys: single-use X25519 key pairs uploaded in batches.
 *   Consumed atomically by the server when another user initiates a session.
 */

import {
  generateX25519KeyPair,
  ed25519Sign,
  toBase64,
  fromBase64,
} from './primitives.js';

/**
 * Compute the canonical proof-of-possession message for a prekey bundle.
 * The signer proves they control the signing key's private counterpart.
 * Includes userId (prevents cross-user replay) and timestamp (prevents indefinite replay).
 *
 * @param {string} userId — authenticated user ID
 * @param {string} identityKeyB64 — base64 identity public key
 * @param {string} signingKeyB64 — base64 signing public key
 * @param {number} registrationId
 * @param {number} timestamp — Date.now() at proof creation
 * @returns {Uint8Array}
 */
function buildProofMessage(userId, identityKeyB64, signingKeyB64, registrationId, timestamp) {
  return new TextEncoder().encode(
    `bundle-proof:${userId}:${identityKeyB64}:${signingKeyB64}:${registrationId}:${timestamp}`
  );
}

/**
 * Generate a signed prekey.
 * The public key is signed with the identity's Ed25519 signing key.
 *
 * @param {Uint8Array} signingPrivateKey — Ed25519 private key
 * @param {number} keyId — sequential key identifier
 * @returns {{ keyId, keyPair: {privateKey, publicKey}, signature: Uint8Array, timestamp: number }}
 */
export function generateSignedPreKey(signingPrivateKey, keyId) {
  const keyPair = generateX25519KeyPair();
  // Sign a canonical message binding the keyId to the public key.
  // This must match the server-side verification format in keys.js.
  const publicKeyB64 = toBase64(keyPair.publicKey);
  const spkMessage = new TextEncoder().encode(`spk:${keyId}:${publicKeyB64}`);
  const signature = ed25519Sign(signingPrivateKey, spkMessage);
  return {
    keyId,
    keyPair,
    signature,
    timestamp: Date.now(),
  };
}

/**
 * Generate a batch of one-time prekeys.
 *
 * @param {number} startId — starting key ID
 * @param {number} count — number of keys to generate
 * @returns {Array<{ keyId, keyPair: {privateKey, publicKey} }>}
 */
export function generateOneTimePreKeys(startId, count) {
  const keys = [];
  for (let i = 0; i < count; i++) {
    keys.push({
      keyId: startId + i,
      keyPair: generateX25519KeyPair(),
    });
  }
  return keys;
}

/**
 * Build the public-only prekey bundle for server upload.
 * Private keys are NOT included — they stay in the local key store.
 *
 * @param {string} userId — authenticated user ID (bound into proof to prevent cross-user replay)
 * @param {{ identityKey: {publicKey}, signingKey: {publicKey, privateKey}, registrationId }} identity
 * @param {{ keyId, keyPair: {publicKey}, signature }} signedPreKey
 * @param {Array<{ keyId, keyPair: {publicKey} }>} oneTimePreKeys
 * @returns {object} — JSON-serializable bundle for POST /api/keys/bundle
 */
export function buildPreKeyBundle(userId, identity, signedPreKey, oneTimePreKeys) {
  const identityKeyB64 = toBase64(identity.identityKey.publicKey);
  const signingKeyB64 = toBase64(identity.signingKey.publicKey);
  const registrationId = identity.registrationId;

  // Proof of possession: sign the bundle's canonical message with the signing key.
  // Includes userId and timestamp to prevent cross-user and temporal replay.
  const proofTimestamp = Date.now();
  const proofMessage = buildProofMessage(userId, identityKeyB64, signingKeyB64, registrationId, proofTimestamp);
  const proof = toBase64(ed25519Sign(identity.signingKey.privateKey, proofMessage));

  return {
    identityKey: identityKeyB64,
    signingKey: signingKeyB64,
    registrationId,
    proof,
    proofTimestamp,
    signedPreKey: {
      keyId: signedPreKey.keyId,
      publicKey: toBase64(signedPreKey.keyPair.publicKey),
      signature: toBase64(signedPreKey.signature),
    },
    oneTimePreKeys: oneTimePreKeys.map(otk => ({
      keyId: otk.keyId,
      publicKey: toBase64(otk.keyPair.publicKey),
    })),
  };
}

/**
 * Build a rotation proof: sign the NEW signing key with the OLD signing key.
 * Required when uploading a bundle with a different signing key than what's on the server.
 *
 * @param {Uint8Array} oldSigningPrivateKey
 * @param {string} newSigningKeyB64 — base64 of the new signing public key
 * @returns {string} base64-encoded Ed25519 signature
 */
export function buildRotationProof(oldSigningPrivateKey, userId, newSigningKeyB64, timestamp) {
  const message = new TextEncoder().encode(`bundle-rotate:${userId}:${newSigningKeyB64}:${timestamp}`);
  return toBase64(ed25519Sign(oldSigningPrivateKey, message));
}

/**
 * Serialize a signed prekey for local storage (includes private key).
 */
export function serializeSignedPreKey(spk) {
  return {
    keyId: spk.keyId,
    privateKey: toBase64(spk.keyPair.privateKey),
    publicKey: toBase64(spk.keyPair.publicKey),
    signature: toBase64(spk.signature),
    timestamp: spk.timestamp,
  };
}

/**
 * Deserialize a signed prekey from local storage.
 */
export function deserializeSignedPreKey(data) {
  return {
    keyId: data.keyId,
    keyPair: {
      privateKey: fromBase64(data.privateKey),
      publicKey: fromBase64(data.publicKey),
    },
    signature: fromBase64(data.signature),
    timestamp: data.timestamp,
  };
}

/**
 * Serialize one-time prekeys for local storage (includes private keys).
 */
export function serializeOneTimePreKeys(otps) {
  return otps.map(otk => ({
    keyId: otk.keyId,
    privateKey: toBase64(otk.keyPair.privateKey),
    publicKey: toBase64(otk.keyPair.publicKey),
  }));
}

/**
 * Deserialize a one-time prekey from local storage.
 */
export function deserializeOneTimePreKey(data) {
  return {
    keyId: data.keyId,
    keyPair: {
      privateKey: fromBase64(data.privateKey),
      publicKey: fromBase64(data.publicKey),
    },
  };
}
