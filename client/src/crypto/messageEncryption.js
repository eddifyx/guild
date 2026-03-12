/**
 * /guild E2E Encryption — Message Encryption API
 *
 * High-level encrypt/decrypt functions used by useMessages.js hook.
 * Routes between v2 (libsignal via IPC) and v1 (backward compat) formats.
 *
 * Envelope formats:
 *   v2 DM:    { v: 2, type: 2|3,  payload: "base64(CiphertextMessage)" }
 *   v2 Group: { v: 2, type: 7,    payload: "base64(SenderKeyMessage)" }
 *   v1 DM:    { v: 1, type: "x3dh_init"|"ratchet", rh: {...}, ct, nc, x3dh? }
 *   v1 Group: { v: 1, type: "sender_key", skid, iter, ct, nc, sig }
 */

import {
  isE2EInitialized,
  isV1StoreReady,
  decryptV1Message,
} from './sessionManager.js';
import { signalEncrypt, signalDecrypt } from './signalClient.js';
import { fromBase64 } from './primitives.js';

// ---------------------------------------------------------------------------
// DM Encryption (v2: PQXDH + Double Ratchet via libsignal)
// ---------------------------------------------------------------------------

/**
 * Encrypt a direct message for a specific recipient (always v2).
 *
 * @param {string} recipientUserId
 * @param {string|null} textContent
 * @param {Array} [attachmentMeta]
 * @returns {Promise<string>} JSON-encoded v2 encrypted envelope
 */
export async function encryptDirectMessage(recipientUserId, textContent, attachmentMeta) {
  if (!isE2EInitialized()) throw new Error('E2E encryption not initialized');

  const payload = {
    body: textContent,
    attachments: attachmentMeta || [],
    ts: Date.now(),
  };

  const result = await signalEncrypt(recipientUserId, JSON.stringify(payload));

  return JSON.stringify({
    v: 2,
    type: result.type,
    payload: result.payload,
  });
}

/**
 * Decrypt a direct message. Automatically routes v1 or v2.
 *
 * @param {string} senderUserId
 * @param {string} envelopeJson
 * @returns {Promise<{ body: string|null, attachments: Array, ts: number }>}
 */
export async function decryptDirectMessage(senderUserId, envelopeJson) {
  if (!isE2EInitialized()) throw new Error('E2E encryption not initialized');

  const envelope = typeof envelopeJson === 'string' ? JSON.parse(envelopeJson) : envelopeJson;

  if (envelope.v === 2) {
    const plaintext = await signalDecrypt(senderUserId, envelope.type, envelope.payload);
    return JSON.parse(plaintext);
  }

  if (envelope.v === 1) {
    return _decryptV1DM(senderUserId, envelope);
  }

  throw new Error(`Unsupported protocol version: ${envelope.v}`);
}

/**
 * V1 backward compat: decrypt a v1 DM envelope using the old Double Ratchet.
 */
async function _decryptV1DM(senderUserId, envelope) {
  if (!isV1StoreReady()) {
    throw new Error('Cannot decrypt legacy message — v1 key store unavailable');
  }

  if (envelope.type !== 'x3dh_init' && envelope.type !== 'ratchet') {
    throw new Error(`Invalid v1 envelope type: ${envelope.type}`);
  }
  if (!envelope.rh || typeof envelope.rh.dh !== 'string' ||
      !Number.isInteger(envelope.rh.pn) || !Number.isInteger(envelope.rh.n)) {
    throw new Error('Invalid v1 envelope: malformed ratchet header');
  }
  if (!envelope.ct || !envelope.nc) {
    throw new Error('Invalid v1 envelope: missing ciphertext or nonce');
  }
  if (envelope.type === 'x3dh_init' && !envelope.x3dh) {
    throw new Error('Invalid v1 envelope: x3dh_init without x3dh header');
  }

  const header = { dh: envelope.rh.dh, pn: envelope.rh.pn, n: envelope.rh.n };
  const ciphertext = fromBase64(envelope.ct);
  const nonce = fromBase64(envelope.nc);
  const x3dhHeader = envelope.type === 'x3dh_init' ? envelope.x3dh : null;

  const plaintext = await decryptV1Message(senderUserId, header, ciphertext, nonce, x3dhHeader);
  const payload = JSON.parse(new TextDecoder().decode(plaintext));

  return {
    body: payload.body,
    attachments: payload.attachments || [],
    ts: payload.ts,
  };
}

// ---------------------------------------------------------------------------
// Group Encryption (v2: Sender Keys via libsignal)
// ---------------------------------------------------------------------------

/**
 * Encrypt a room/group message using Sender Keys (always v2).
 */
export async function encryptGroupMessage(roomId, textContent, attachmentMeta) {
  if (!isE2EInitialized()) throw new Error('E2E encryption not initialized');

  const { encryptWithSenderKey } = await import('./senderKeys.js');
  return encryptWithSenderKey(roomId, textContent, attachmentMeta);
}

/**
 * Decrypt a room/group message. Automatically routes v1 or v2.
 */
export async function decryptGroupMessage(roomId, senderUserId, envelopeJson) {
  if (!isE2EInitialized()) throw new Error('E2E encryption not initialized');

  const { decryptWithSenderKey } = await import('./senderKeys.js');
  return decryptWithSenderKey(roomId, senderUserId, envelopeJson);
}
