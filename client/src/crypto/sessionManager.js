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
  resetSignalLocalState,
} from './signalClient.js';

// V1 backward compat imports (kept for historical message decryption)
import { getKeyStore, resetKeyStore } from './keyStore.js';
import { processX3DHInitMessage } from './x3dh.js';
import { initializeSessionAsBob, ratchetDecrypt } from './doubleRatchet.js';
import { createLegacySessionRuntime } from '../features/crypto/legacySessionRuntime.mjs';
import {
  createSessionManagerRuntime,
  removeLegacyV1MasterKey,
} from '../features/crypto/sessionManagerRuntime.mjs';

const _sessionState = {
  initialized: false,
  e2eExpected: false,
  userId: null,
  initPromise: null,
  v1StoreReady: false,
  lifecycleVersion: 0,
};

const _v1SessionLocks = new Map();
const sessionManagerRuntime = createSessionManagerRuntime({
  state: _sessionState,
  initializeSignalCryptoFn: initializeSignalCrypto,
  destroySignalCryptoFn: destroySignalCrypto,
  getKeyStoreFn: getKeyStore,
  resetKeyStoreFn: resetKeyStore,
  clearSessionLocksFn: () => _v1SessionLocks.clear(),
  loadExistingV1MasterKeyFn: removeLegacyV1MasterKey,
});

const legacySessionRuntime = createLegacySessionRuntime({
  sessionLocks: _v1SessionLocks,
  isV1StoreReadyFn: () => _sessionState.v1StoreReady,
  getKeyStoreFn: getKeyStore,
  processX3DHInitMessageFn: processX3DHInitMessage,
  initializeSessionAsBobFn: initializeSessionAsBob,
  ratchetDecryptFn: ratchetDecrypt,
  getCurrentUserIdFn: () => _sessionState.userId,
});

export const initializeCryptoIdentity = sessionManagerRuntime.initializeCryptoIdentity;
export const destroyCryptoState = sessionManagerRuntime.destroyCryptoState;
export const clearPersistedSignalLocalState = resetSignalLocalState;
export const isE2EInitialized = sessionManagerRuntime.isE2EInitialized;
export const wasE2EExpected = sessionManagerRuntime.wasE2EExpected;
export const getCurrentUserId = sessionManagerRuntime.getCurrentUserId;
export const isV1StoreReady = sessionManagerRuntime.isV1StoreReady;

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
  return legacySessionRuntime.decryptV1Message(senderUserId, header, ciphertext, nonce, x3dhHeader);
}
