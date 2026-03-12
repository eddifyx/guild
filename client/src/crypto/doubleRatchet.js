/**
 * /guild E2E Encryption — Double Ratchet Algorithm
 *
 * Implements the Signal Double Ratchet for per-message forward secrecy.
 * Each message is encrypted with a unique key derived from a ratcheting chain.
 *
 * Reference: https://signal.org/docs/specifications/doubleratchet/
 *
 * Components:
 *   - DH Ratchet: new X25519 key pair per exchange turn
 *   - Symmetric-key Ratchet: KDF chain for deriving per-message keys
 *   - Skipped message keys: handles out-of-order delivery
 *
 * Session state (serialized per conversation):
 *   { DHs, DHr, RK, CKs, CKr, Ns, Nr, PN, MKSKIPPED }
 */

import {
  generateX25519KeyPair,
  x25519DH,
  rejectSmallOrderPoint,
  assertNonZeroDH,
  hkdfSha256,
  hmacSha256,
  aes256GcmEncrypt,
  aes256GcmDecrypt,
  concatBytes,
  toBase64,
  fromBase64,
  toHex,
} from './primitives.js';

const MAX_SKIP = 1000;
const MAX_SKIPPED_TOTAL = 5000; // Global cap on stored skipped message keys
const MAX_COUNTER = Number.MAX_SAFE_INTEGER - 1; // Prevent JS integer precision loss
const RATCHET_INFO = 'ByzantineRatchet';

// ---------------------------------------------------------------------------
// KDF functions
// ---------------------------------------------------------------------------

/**
 * Root Key KDF: derive new root key and chain key from a DH output.
 * @returns {[Uint8Array, Uint8Array]} [newRootKey, chainKey]
 */
function KDF_RK(rootKey, dhOutput) {
  const derived = hkdfSha256(dhOutput, rootKey, RATCHET_INFO, 64);
  return [derived.slice(0, 32), derived.slice(32, 64)];
}

/**
 * Chain Key KDF: advance a chain key and derive a message key.
 * @returns {[Uint8Array, Uint8Array]} [newChainKey, messageKey]
 */
function KDF_CK(chainKey) {
  const messageKey = hmacSha256(chainKey, new Uint8Array([0x01]));
  const newChainKey = hmacSha256(chainKey, new Uint8Array([0x02]));
  return [newChainKey, messageKey];
}

// ---------------------------------------------------------------------------
// Header encoding for AAD
// ---------------------------------------------------------------------------

function encodeAAD(header, senderId, recipientId) {
  const json = JSON.stringify({
    dh: header.dh,
    pn: header.pn,
    n: header.n,
    sid: senderId,
    rid: recipientId,
  });
  return new TextEncoder().encode(json);
}

// ---------------------------------------------------------------------------
// Session initialization
// ---------------------------------------------------------------------------

/**
 * Initialize a Double Ratchet session as Alice (initiator).
 * Called after X3DH by the person who initiated the key exchange.
 *
 * @param {Uint8Array} sharedSecret — SK from X3DH
 * @param {Uint8Array} bobSignedPreKeyPublic — Bob's signed prekey public key (becomes first DHr)
 * @returns {object} initial session state
 */
export function initializeSessionAsAlice(sharedSecret, bobSignedPreKeyPublic) {
  // Generate Alice's first DH ratchet key pair
  const DHs = generateX25519KeyPair();

  // Perform DH ratchet step with Bob's signed prekey
  const dhOutput = x25519DH(DHs.privateKey, bobSignedPreKeyPublic);
  const [RK, CKs] = KDF_RK(sharedSecret, dhOutput);

  // Zero intermediate DH output
  dhOutput.fill(0);

  const result = {
    DHs: { privateKey: toBase64(DHs.privateKey), publicKey: toBase64(DHs.publicKey) },
    DHr: toBase64(bobSignedPreKeyPublic),
    RK: toBase64(RK),
    CKs: toBase64(CKs),
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKSKIPPED: {},
  };

  // Zero raw key material
  DHs.privateKey.fill(0);
  RK.fill(0);
  CKs.fill(0);

  return result;
}

/**
 * Initialize a Double Ratchet session as Bob (responder).
 * Called after processing X3DH as the person who received the initial message.
 *
 * @param {Uint8Array} sharedSecret — SK from X3DH
 * @param {{ privateKey: Uint8Array, publicKey: Uint8Array }} signedPreKeyPair — Bob's signed prekey pair
 * @returns {object} initial session state
 */
export function initializeSessionAsBob(sharedSecret, signedPreKeyPair) {
  return {
    DHs: { privateKey: toBase64(signedPreKeyPair.privateKey), publicKey: toBase64(signedPreKeyPair.publicKey) },
    DHr: null,
    RK: toBase64(sharedSecret),
    CKs: null,
    CKr: null,
    Ns: 0,
    Nr: 0,
    PN: 0,
    MKSKIPPED: {},
  };
}

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a message using the Double Ratchet.
 *
 * @param {object} state — current session state (MUTATED in place)
 * @param {Uint8Array} plaintext — message to encrypt
 * @param {string} senderId — our user ID (bound into AAD)
 * @param {string} recipientId — their user ID (bound into AAD)
 * @returns {{ header: {dh, pn, n}, ciphertext: Uint8Array, nonce: Uint8Array, state: object }}
 */
export function ratchetEncrypt(state, plaintext, senderId, recipientId) {
  if (state.CKs === null) {
    throw new Error('Cannot encrypt: sending chain not initialized. Must receive a message first.');
  }
  if (state.Ns >= MAX_COUNTER) {
    throw new Error('Sending counter exhausted. Session must be re-established.');
  }
  // Advance sending chain
  const CKs = fromBase64(state.CKs);
  const [newCKs, messageKey] = KDF_CK(CKs);
  CKs.fill(0); // Zero old chain key material

  // Build header
  const header = {
    dh: state.DHs.publicKey, // already base64
    pn: state.PN,
    n: state.Ns,
  };

  // Encrypt with message key, using header + user IDs as AAD
  const aad = encodeAAD(header, senderId, recipientId);
  const { ciphertext, nonce } = aes256GcmEncrypt(messageKey, plaintext, aad);

  // Update state
  state.CKs = toBase64(newCKs);
  newCKs.fill(0);
  state.Ns += 1;

  // Securely erase message key
  messageKey.fill(0);

  return { header, ciphertext, nonce, state };
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt a message using the Double Ratchet.
 *
 * @param {object} state — current session state (MUTATED in place)
 * @param {{ dh: string, pn: number, n: number }} header — message header
 * @param {Uint8Array} ciphertext — encrypted message
 * @param {Uint8Array} nonce — encryption nonce
 * @param {string} senderId — sender's user ID (bound into AAD)
 * @param {string} recipientId — recipient's user ID (bound into AAD)
 * @returns {{ plaintext: Uint8Array, state: object }}
 */
export function ratchetDecrypt(state, header, ciphertext, nonce, senderId, recipientId) {
  // Validate header fields to prevent NaN/Infinity bypassing skip logic
  // and counter overflow past MAX_SAFE_INTEGER
  if (!Number.isInteger(header.n) || header.n < 0 || header.n > MAX_COUNTER ||
      !Number.isInteger(header.pn) || header.pn < 0 || header.pn > MAX_COUNTER) {
    throw new Error('Invalid message header: n and pn must be non-negative integers within safe range');
  }

  // 1. Try skipped message keys first
  const skipKey = `${header.dh}:${header.n}`;
  if (state.MKSKIPPED[skipKey]) {
    const mk = fromBase64(state.MKSKIPPED[skipKey]);
    const aad = encodeAAD(header, senderId, recipientId);
    // Decrypt BEFORE deleting the key — if GCM fails, the key is preserved for retry
    const plaintext = aes256GcmDecrypt(mk, ciphertext, nonce, aad);
    delete state.MKSKIPPED[skipKey];
    mk.fill(0);
    return { plaintext, state };
  }

  // Work on a snapshot so a decrypt failure doesn't corrupt the real session.
  // GCM auth failure would otherwise leave the ratchet in an irrecoverable state.
  const s = cloneSessionState(state);

  // 2. If the header DH key differs from our stored DHr, perform a DH ratchet step
  if (header.dh !== s.DHr) {
    // Validate the DH public key from the header
    const headerDHBytes = fromBase64(header.dh);
    if (headerDHBytes.length !== 32) {
      throw new Error('Invalid DH ratchet key: must be 32 bytes');
    }
    // Reject small-order points that produce all-zero shared secrets
    rejectSmallOrderPoint(headerDHBytes, 'DH ratchet key');

    // Skip any remaining messages in the current receiving chain
    if (s.CKr !== null) {
      skipMessageKeys(s, header.pn);
    }

    // DH Ratchet step
    s.PN = s.Ns;
    s.Ns = 0;
    s.Nr = 0;
    s.DHr = header.dh;

    // Receiving chain: DH with our current DH private key and their new DH public key
    const oldDHsPrivate = fromBase64(s.DHs.privateKey);
    const dhOutput1 = x25519DH(oldDHsPrivate, headerDHBytes);
    oldDHsPrivate.fill(0);
    assertNonZeroDH(dhOutput1, 'Ratchet DH1 (recv)');
    const RK1 = fromBase64(s.RK);
    const [newRK1, CKr] = KDF_RK(RK1, dhOutput1);
    dhOutput1.fill(0);
    RK1.fill(0);
    s.RK = toBase64(newRK1);
    s.CKr = toBase64(CKr);
    newRK1.fill(0);
    CKr.fill(0);

    // Generate new DH key pair for sending
    const newDHs = generateX25519KeyPair();
    const dhOutput2 = x25519DH(newDHs.privateKey, fromBase64(header.dh));
    assertNonZeroDH(dhOutput2, 'Ratchet DH2 (send)');
    const RK2 = fromBase64(s.RK);
    const [newRK2, CKs] = KDF_RK(RK2, dhOutput2);
    dhOutput2.fill(0);
    RK2.fill(0);
    s.RK = toBase64(newRK2);
    s.CKs = toBase64(CKs);
    newRK2.fill(0);
    CKs.fill(0);
    s.DHs = { privateKey: toBase64(newDHs.privateKey), publicKey: toBase64(newDHs.publicKey) };
    newDHs.privateKey.fill(0);
  }

  // 3. Skip messages in the receiving chain if needed
  skipMessageKeys(s, header.n);

  // 4. Derive message key from receiving chain
  if (s.CKr === null) {
    throw new Error('Cannot decrypt: receiving chain not initialized.');
  }
  const CKr = fromBase64(s.CKr);
  const [newCKr, messageKey] = KDF_CK(CKr);
  CKr.fill(0); // Zero old chain key material
  s.CKr = toBase64(newCKr);
  s.Nr += 1;

  // 5. Decrypt — if this throws (GCM auth failure), the original state is untouched
  const aad = encodeAAD(header, senderId, recipientId);
  const plaintext = aes256GcmDecrypt(messageKey, ciphertext, nonce, aad);
  messageKey.fill(0);

  // Decryption succeeded — commit the snapshot back to the real state
  Object.assign(state, s);

  return { plaintext, state };
}

// ---------------------------------------------------------------------------
// Skip message keys (for out-of-order delivery)
// ---------------------------------------------------------------------------

function skipMessageKeys(state, until) {
  if (state.CKr === null) return;

  if (until - state.Nr > MAX_SKIP) {
    throw new Error(`Cannot skip more than ${MAX_SKIP} messages`);
  }

  while (state.Nr < until) {
    const CKr = fromBase64(state.CKr);
    const [newCKr, mk] = KDF_CK(CKr);
    CKr.fill(0); // Zero old chain key material
    const skipKey = `${state.DHr}:${state.Nr}`;
    state.MKSKIPPED[skipKey] = toBase64(mk);
    state.CKr = toBase64(newCKr);
    state.Nr += 1;
    mk.fill(0);
  }

  // Evict oldest entries if global cap exceeded
  const keys = Object.keys(state.MKSKIPPED);
  if (keys.length > MAX_SKIPPED_TOTAL) {
    const toRemove = keys.length - MAX_SKIPPED_TOTAL;
    for (let i = 0; i < toRemove; i++) {
      delete state.MKSKIPPED[keys[i]];
    }
  }
}

// ---------------------------------------------------------------------------
// Session state serialization (already JSON-compatible via base64)
// ---------------------------------------------------------------------------

/**
 * Clone session state for safe storage.
 */
export function cloneSessionState(state) {
  return JSON.parse(JSON.stringify(state));
}
