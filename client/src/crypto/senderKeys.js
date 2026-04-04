/**
 * /guild E2E Encryption — Sender Keys (Group Messaging v2)
 *
 * Uses libsignal Sender Keys via IPC (all crypto in main process).
 * Distribution: SenderKeyDistributionMessage encrypted via DM to each member.
 * Keeps v1 decrypt path for historical group messages.
 */

import { getCurrentUserId, isV1StoreReady } from './sessionManager.js';
import {
  createSKDM,
  processSKDM,
  groupEncrypt as signalGroupEncrypt,
  groupDecrypt as signalGroupDecrypt,
  rekeyRoom as signalRekeyRoom,
} from './signalClient.js';
import { encryptDirectMessage } from './messageEncryption.js';
import { api } from '../api.js';
import { getSocket } from '../socket.js';
import { rememberUsers } from './identityDirectory.js';
import {
  buildSenderKeyDistributionPayload,
  emitSenderKeyDistributionWarning,
  runWithConcurrency,
  selectSenderKeyRecipients,
  summarizeSenderKeyDistributionResults,
  validateLegacySenderKeyPayload,
  validateSenderKeyDistributionPayload,
} from '../features/crypto/senderKeyDistributionRuntime.mjs';

// V1 imports for backward compat decryption
import { getKeyStore } from './keyStore.js';
import {
  hmacSha256,
  aes256GcmDecrypt,
  ed25519Verify,
  fromBase64,
  toBase64,
  concatBytes,
} from './primitives.js';
import { createSenderKeyLegacyRuntime } from '../features/crypto/senderKeyLegacyRuntime.mjs';
import { createSenderKeyRoomRuntime } from '../features/crypto/senderKeyRoomRuntime.mjs';

const MAX_SENDER_KEY_SKIP = 256;
const MAX_ITERATION = Number.MAX_SAFE_INTEGER - 1;
const SKDM_DISTRIBUTION_CONCURRENCY = 4;

const senderKeyLegacyRuntime = createSenderKeyLegacyRuntime({
  getKeyStoreFn: getKeyStore,
  isV1StoreReadyFn: isV1StoreReady,
  apiRequestFn: api,
  validateLegacySenderKeyPayloadFn: validateLegacySenderKeyPayload,
  fromBase64Fn: fromBase64,
  toBase64Fn: toBase64,
  concatBytesFn: concatBytes,
  ed25519VerifyFn: ed25519Verify,
  aes256GcmDecryptFn: aes256GcmDecrypt,
  hmacSha256Fn: hmacSha256,
  maxIteration: MAX_ITERATION,
  maxSenderKeySkip: MAX_SENDER_KEY_SKIP,
});
const senderKeyRoomRuntime = createSenderKeyRoomRuntime({
  getCurrentUserIdFn: getCurrentUserId,
  createSKDMFn: createSKDM,
  processSKDMFn: processSKDM,
  groupEncryptFn: signalGroupEncrypt,
  groupDecryptFn: signalGroupDecrypt,
  rekeyRoomFn: signalRekeyRoom,
  encryptDirectMessageFn: encryptDirectMessage,
  apiRequestFn: api,
  getSocketFn: getSocket,
  rememberUsersFn: rememberUsers,
  buildSenderKeyDistributionPayloadFn: buildSenderKeyDistributionPayload,
  emitSenderKeyDistributionWarningFn: (warning) => emitSenderKeyDistributionWarning({
    ...warning,
    windowObj: typeof window !== 'undefined' ? window : null,
  }),
  runWithConcurrencyFn: runWithConcurrency,
  selectSenderKeyRecipientsFn: selectSenderKeyRecipients,
  summarizeSenderKeyDistributionResultsFn: summarizeSenderKeyDistributionResults,
  distributionConcurrency: SKDM_DISTRIBUTION_CONCURRENCY,
});

// ---------------------------------------------------------------------------
// V2 Group Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a group message using Sender Keys (always v2).
 */
export async function encryptWithSenderKey(roomId, textContent, attachmentMeta) {
  return senderKeyRoomRuntime.encryptWithSenderKey(roomId, textContent, attachmentMeta);
}

// ---------------------------------------------------------------------------
// V2 / V1 Group Decrypt
// ---------------------------------------------------------------------------

/**
 * Decrypt a group message. Routes v1/v2 automatically.
 */
export async function decryptWithSenderKey(roomId, senderUserId, envelopeJson) {
  const envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;

  if (envelope.v === 2) {
    return senderKeyRoomRuntime.decryptRoomSenderKey(roomId, senderUserId, envelope);
  }

  if (envelope.v === 1) {
    return senderKeyLegacyRuntime.decryptLegacySenderKey(roomId, senderUserId, envelope);
  }

  throw new Error(`Unsupported sender key protocol version: ${envelope.v}`);
}

// ---------------------------------------------------------------------------
// Process Incoming Sender Key Distribution
// ---------------------------------------------------------------------------

/**
 * Process an already-decrypted sender key distribution payload.
 * Handles both v2 (libsignal SKDM) and v1 (raw chain key) formats.
 * Called from socket.js after it decrypts the DM envelope.
 */
export async function processDecryptedSenderKey(fromUserId, payload) {
  try {
    const validated = validateSenderKeyDistributionPayload({
      fromUserId,
      payload,
    });
    if (!validated.handled) return;

    // V2: libsignal SKDM (opaque bytes)
    if (validated.version === 2) {
      await senderKeyRoomRuntime.processSenderKeyDistribution(fromUserId, payload);
      return;
    }

    // V1: raw chain key + signing key (backward compat)
    if (validated.version === 1) {
      await senderKeyLegacyRuntime.processLegacySenderKey(fromUserId, payload);
      return;
    }
  } catch (err) {
    console.error('[SK] Failed to process sender key:', err);
    err.retryable = !(
      err.message?.includes('not a member') ||
      err.message?.includes('could not verify') ||
      err.message?.includes('Unknown sender key distribution format') ||
      err.message?.includes('rollback rejected')
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Re-key Room (called when a member leaves)
// ---------------------------------------------------------------------------

export async function rekeyRoom(roomId) {
  return senderKeyRoomRuntime.rekeyRoom(roomId);
}

export async function redistributeSenderKey(roomId) {
  return senderKeyRoomRuntime.redistributeSenderKey(roomId);
}
