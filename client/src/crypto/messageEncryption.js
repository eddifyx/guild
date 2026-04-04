/**
 * /guild E2E Encryption — Message Encryption API
 *
 * High-level encrypt/decrypt functions used by useMessages.js hook.
 * Routes between v2 (libsignal via IPC) and v1 (backward compat) formats.
 *
 * Envelope formats:
 *   v3 DM:    { v: 3, senderDeviceId, copies: [{ recipientUserId, recipientDeviceId, type, payload }] }
 *   v2 Hybrid:{ v: 2, senderDeviceId, type, payload, copies: [...] }
 *   v2 DM:    { v: 2, type: 2|3,  payload: "base64(CiphertextMessage)" }
 *   v2 Group: { v: 2, type: 7,    payload: "base64(SenderKeyMessage)" }
 *   v1 DM:    { v: 1, type: "x3dh_init"|"ratchet", rh: {...}, ct, nc, x3dh? }
 *   v1 Group: { v: 1, type: "sender_key", skid, iter, ct, nc, sig }
 */

import { isE2EInitialized, isV1StoreReady, decryptV1Message } from './sessionManager.js';
import {
  buildDirectMessageEnvelope,
  getSignalDeviceId,
  getSignalUserId,
  signalDecrypt,
} from './signalClient.js';
import { createDirectMessageEncryptionRuntime } from '../features/crypto/directMessageEncryptionRuntime.mjs';
import { createGroupMessageEncryptionRuntime } from '../features/crypto/groupMessageEncryptionRuntime.mjs';

const directMessageEncryptionRuntime = createDirectMessageEncryptionRuntime({
  isE2EInitializedFn: isE2EInitialized,
  isV1StoreReadyFn: isV1StoreReady,
  buildDirectMessageEnvelopeFn: buildDirectMessageEnvelope,
  getSignalUserIdFn: getSignalUserId,
  getSignalDeviceIdFn: getSignalDeviceId,
  signalDecryptFn: signalDecrypt,
  decryptV1MessageFn: decryptV1Message,
});

const groupMessageEncryptionRuntime = createGroupMessageEncryptionRuntime({
  isE2EInitializedFn: isE2EInitialized,
  importSenderKeysModuleFn: () => import('./senderKeys.js'),
});

export const encryptDirectMessage = directMessageEncryptionRuntime.encryptDirectMessage;
export const decryptDirectMessage = directMessageEncryptionRuntime.decryptDirectMessage;
export const encryptGroupMessage = groupMessageEncryptionRuntime.encryptGroupMessage;
export const decryptGroupMessage = groupMessageEncryptionRuntime.decryptGroupMessage;
