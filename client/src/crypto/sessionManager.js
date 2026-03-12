/**
 * /guild E2E Encryption - Session Manager (v2 facade)
 *
 * Thin orchestration layer that delegates to signalClient.js (v2 libsignal
 * via IPC to main process). Also lazily opens the old v1 IndexedDB key store
 * for backward-compatible decryption of historical messages.
 */

import {
  initializeSignalCrypto,
  destroySignalCrypto,
} from './signalClient.js';

// V1 backward compat imports (kept for historical message decryption)
import { getKeyStore, resetKeyStore } from './keyStore.js';
import { processX3DHInitMessage } from './x3dh.js';
import { initializeSessionAsBob, ratchetDecrypt } from './doubleRatchet.js';
import { fromBase64 } from './primitives.js';

let _initialized = false;
let _e2eExpected = false;
let _userId = null;
let _initPromise = null;
let _v1StoreReady = false;
let _lifecycleVersion = 0;

// V1 session lock to prevent concurrent v1 decrypt from corrupting ratchet state
const _v1SessionLocks = new Map();

// ---------------------------------------------------------------------------
// Initialization (called on login from AuthContext)
// ---------------------------------------------------------------------------

export async function initializeCryptoIdentity(authData) {
  _e2eExpected = true; // Once attempted, E2E is expected for this session
  if (_initialized && _userId === authData.userId) return;
  if (_initPromise) return _initPromise;

  const lifecycleVersion = _lifecycleVersion;
  const initPromise = _doInit(authData, lifecycleVersion);
  const trackedPromise = initPromise.finally(() => {
    if (_initPromise === trackedPromise) _initPromise = null;
  });

  _initPromise = trackedPromise;
  return trackedPromise;
}

async function _doInit(authData, lifecycleVersion) {
  // V2: Initialize libsignal crypto in main process via IPC
  await initializeSignalCrypto(authData);
  if (lifecycleVersion !== _lifecycleVersion) return;

  let v1StoreReady = false;

  // V1 backward compat: try to open old IndexedDB key store (read-only, for
  // decrypting historical messages encrypted with the old protocol)
  try {
    const masterKey = await _loadExistingV1MasterKey(authData.userId);
    if (masterKey) {
      const keyStore = getKeyStore();
      await keyStore.initialize(masterKey);
      masterKey.fill(0);
      v1StoreReady = true;
    }
  } catch {
    v1StoreReady = false;
  }

  if (lifecycleVersion !== _lifecycleVersion) return;

  _v1StoreReady = v1StoreReady;
  _initialized = true;
  _userId = authData.userId;
}

/**
 * Load existing v1 master key (does NOT create a new one).
 * Returns null if no v1 key exists or safeStorage is unavailable.
 */
async function _loadExistingV1MasterKey(userId) {
  const storageKey = `byzantine-mk-${userId}`;
  if (window.electronCrypto && await window.electronCrypto.isEncryptionAvailable()) {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const decrypted = await window.electronCrypto.decryptString(stored);
        return fromBase64(decrypted);
      } catch { return null; }
    }
  }
  return null;
}

/**
 * Close the E2E encryption state (called on logout).
 */
export async function destroyCryptoState() {
  const inFlightInit = _initPromise;
  _lifecycleVersion += 1;
  _initialized = false;
  _e2eExpected = false;
  _userId = null;
  _v1StoreReady = false;
  _v1SessionLocks.clear();

  if (inFlightInit) {
    await inFlightInit.catch(() => {});
  }

  await destroySignalCrypto();
  resetKeyStore();
  _initPromise = null;
}

// ---------------------------------------------------------------------------
// State accessors (used throughout the app)
// ---------------------------------------------------------------------------

export function isE2EInitialized() { return _initialized; }
export function wasE2EExpected() { return _e2eExpected && !_initialized; }
export function getCurrentUserId() { return _userId; }
export function isV1StoreReady() { return _v1StoreReady; }

// ---------------------------------------------------------------------------
// V1 Backward Compat: DM Decryption
// ---------------------------------------------------------------------------

function withV1SessionLock(userId, fn) {
  const prev = _v1SessionLocks.get(userId) || Promise.resolve();
  let resolve;
  const next = new Promise(r => { resolve = r; });
  _v1SessionLocks.set(userId, next);
  return prev.then(() => fn().finally(() => {
    if (_v1SessionLocks.get(userId) === next) _v1SessionLocks.delete(userId);
    resolve();
  }));
}

/**
 * Decrypt a v1 DM message using the old Double Ratchet implementation.
 * Best-effort for historical messages - will fail if the ratchet has
 * advanced past the message's position.
 *
 * @param {string} senderUserId
 * @param {{ dh, pn, n }} header
 * @param {Uint8Array} ciphertext
 * @param {Uint8Array} nonce
 * @param {object} [x3dhHeader]
 * @returns {Promise<Uint8Array>} plaintext
 */
export async function decryptV1Message(senderUserId, header, ciphertext, nonce, x3dhHeader) {
  if (!_v1StoreReady) throw new Error('V1 key store not available');

  return withV1SessionLock(senderUserId, async () => {
    const keyStore = getKeyStore();

    // If X3DH header present, establish session as Bob
    if (x3dhHeader) {
      const hasSession = await keyStore.hasSession(senderUserId);
      if (!hasSession) {
        const { sharedSecret, signedPreKeyPair } =
          await processX3DHInitMessage(keyStore, x3dhHeader);
        const session = initializeSessionAsBob(sharedSecret, signedPreKeyPair);
        await keyStore.saveSession(senderUserId, session);
        sharedSecret.fill(0);
      }
    }

    const session = await keyStore.getSession(senderUserId);
    if (!session) throw new Error(`No v1 session with user ${senderUserId}`);

    try {
      const { plaintext, state: updatedState } =
        ratchetDecrypt(session, header, ciphertext, nonce, senderUserId, _userId);
      await keyStore.saveSession(senderUserId, updatedState);
      return plaintext;
    } catch (err) {
      // Device reset: retry with fresh X3DH session
      if (x3dhHeader) {
        const { sharedSecret, signedPreKeyPair } =
          await processX3DHInitMessage(keyStore, x3dhHeader);
        const freshSession = initializeSessionAsBob(sharedSecret, signedPreKeyPair);
        await keyStore.saveSession(senderUserId, freshSession);
        sharedSecret.fill(0);

        const { plaintext, state: updatedState } =
          ratchetDecrypt(freshSession, header, ciphertext, nonce, senderUserId, _userId);
        await keyStore.saveSession(senderUserId, updatedState);
        return plaintext;
      }
      throw err;
    }
  });
}
