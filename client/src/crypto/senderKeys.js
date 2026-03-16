/**
 * /guild E2E Encryption — Sender Keys (Group Messaging v2)
 *
 * Uses libsignal Sender Keys via IPC (all crypto in main process).
 * Distribution: SenderKeyDistributionMessage encrypted via DM to each member.
 * Keeps v1 decrypt path for historical group messages.
 */

import { getCurrentUserId, isE2EInitialized, isV1StoreReady } from './sessionManager.js';
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

const MAX_SENDER_KEY_SKIP = 256;
const MAX_ITERATION = Number.MAX_SAFE_INTEGER - 1;

// Track rooms where we've distributed our SKDM (in-memory, reset on reload)
const _distributedRooms = new Set();

// ---------------------------------------------------------------------------
// V2 Group Encrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt a group message using Sender Keys (always v2).
 */
export async function encryptWithSenderKey(roomId, textContent, attachmentMeta) {
  // Ensure SKDM is distributed for this room
  if (!_distributedRooms.has(roomId)) {
    const { skdm, distributionId } = await createSKDM(roomId);
    await _distributeSKDM(roomId, skdm, distributionId);
    _distributedRooms.add(roomId);
  }

  const payload = JSON.stringify({
    body: textContent,
    attachments: attachmentMeta || [],
    ts: Date.now(),
  });

  const ciphertext = await signalGroupEncrypt(roomId, payload);

  return JSON.stringify({
    v: 2,
    type: 7, // CiphertextMessageType.SenderKey
    payload: ciphertext,
  });
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
    const plaintext = await signalGroupDecrypt(senderUserId, roomId, envelope.payload);
    return JSON.parse(plaintext);
  }

  if (envelope.v === 1) {
    return _decryptV1SenderKey(roomId, senderUserId, envelope);
  }

  throw new Error(`Unsupported sender key protocol version: ${envelope.v}`);
}

// ---------------------------------------------------------------------------
// SKDM Distribution (encrypted via DM to each room member)
// ---------------------------------------------------------------------------

async function _distributeSKDM(roomId, skdmBase64, distributionId) {
  const myUserId = getCurrentUserId();

  try {
    const members = await api(`/api/rooms/${roomId}/members`);
    rememberUsers(members);

    const recipients = members.filter(member => (
      member.id !== myUserId &&
      typeof member.npub === 'string' &&
      member.npub.startsWith('npub1')
    ));
    const failures = [];

    for (const member of recipients) {
      const payload = JSON.stringify({
        type: 'sender_key_distribution',
        v: 2,
        roomId,
        senderUserId: myUserId,
        skdm: skdmBase64,
      });

      try {
        const envelope = await encryptDirectMessage(member.id, payload);
        const socket = getSocket();
        if (socket) {
          socket.emit('dm:sender_key', {
            toUserId: member.id,
            envelope,
            roomId,
            distributionId,
          });
        }
      } catch (err) {
        console.error(`[SK] Failed to distribute SKDM to ${member.id}:`, err);
        failures.push(member.username || member.id);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Failed to distribute the room sender key to ${failures.join(', ')}`);
    }
  } catch (err) {
    console.error('[SK] Failed to distribute room sender key:', err);
    throw err;
  }
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
    if (payload.type !== 'sender_key_distribution') return;

    if (payload.senderUserId !== fromUserId) {
      throw new Error(`SKDM sender mismatch: ${payload.senderUserId} vs DM sender ${fromUserId}`);
    }

    // V2: libsignal SKDM (opaque bytes)
    if (payload.v === 2 && payload.skdm) {
      if (payload.roomId) {
        try {
          const members = await api(`/api/rooms/${payload.roomId}/members`);
          rememberUsers(members);
          if (!members.some(m => m.id === fromUserId)) {
            throw new Error(`SKDM: ${fromUserId} is not a member of room ${payload.roomId}`);
          }
        } catch (memberErr) {
          if (memberErr.message.includes('not a member')) throw memberErr;
          throw new Error(`SKDM: could not verify room membership for ${fromUserId}`);
        }
      }
      await processSKDM(fromUserId, payload.skdm);
      return;
    }

    // V1: raw chain key + signing key (backward compat)
    if (payload.chainKey && payload.signingKeyPublic) {
      await _processV1SenderKey(fromUserId, payload);
      return;
    }

    throw new Error('Unknown sender key distribution format');
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
  const { skdm, distributionId } = await signalRekeyRoom(roomId);
  _distributedRooms.delete(roomId);
  await _distributeSKDM(roomId, skdm, distributionId);
  _distributedRooms.add(roomId);
}

export async function redistributeSenderKey(roomId) {
  const { skdm, distributionId } = await createSKDM(roomId);
  await _distributeSKDM(roomId, skdm, distributionId);
}

// ---------------------------------------------------------------------------
// V1 Backward Compat
// ---------------------------------------------------------------------------

async function _processV1SenderKey(fromUserId, payload) {
  if (!isV1StoreReady()) throw new Error('V1 key store not available');

  if (typeof payload.chainKey !== 'string' || typeof payload.signingKeyPublic !== 'string') {
    throw new Error('V1 SKDM: missing chainKey or signingKeyPublic');
  }
  const chainKeyBytes = fromBase64(payload.chainKey);
  const signingKeyBytes = fromBase64(payload.signingKeyPublic);
  if (chainKeyBytes.length !== 32 || signingKeyBytes.length !== 32) {
    throw new Error('V1 SKDM: invalid key lengths');
  }
  if (!Number.isInteger(payload.iteration) || payload.iteration < 0 || payload.iteration > MAX_ITERATION) {
    throw new Error('V1 SKDM: invalid iteration');
  }

  if (payload.roomId) {
    try {
      const members = await api(`/api/rooms/${payload.roomId}/members`);
      if (!members.some(m => m.id === fromUserId)) {
        throw new Error(`V1 SKDM: ${fromUserId} not a member of room ${payload.roomId}`);
      }
    } catch (memberErr) {
      if (memberErr.message.includes('not a member')) throw memberErr;
      throw new Error(`V1 SKDM: could not verify room membership for ${fromUserId}`);
    }
  }

  const keyStore = getKeyStore();
  const existingKey = await keyStore.getSenderKey(payload.roomId, payload.senderUserId);
  if (existingKey && payload.iteration <= existingKey.iteration) {
    throw new Error(`V1 SKDM: rollback rejected (${payload.iteration} <= ${existingKey.iteration})`);
  }

  await keyStore.saveSenderKey(payload.roomId, payload.senderUserId, {
    chainKey: payload.chainKey,
    signingKeyPublic: payload.signingKeyPublic,
    iteration: payload.iteration,
  });
}

/**
 * Decrypt a v1 sender key message using old chain-key derivation.
 */
async function _decryptV1SenderKey(roomId, senderUserId, envelope) {
  if (!isV1StoreReady()) {
    throw new Error('Cannot decrypt legacy group message — v1 key store unavailable');
  }

  if (envelope.type !== 'sender_key') throw new Error('Invalid v1 sender key envelope');
  if (envelope.skid !== senderUserId) {
    throw new Error(`V1 SK: sender mismatch ${envelope.skid} vs ${senderUserId}`);
  }

  const keyStore = getKeyStore();
  const senderKey = await keyStore.getSenderKey(roomId, envelope.skid);
  if (!senderKey) throw new Error(`No v1 sender key for ${envelope.skid} in room ${roomId}`);

  const ctBytes = fromBase64(envelope.ct);
  const ncBytes = fromBase64(envelope.nc);
  const sigBytes = fromBase64(envelope.sig);
  const sigPub = fromBase64(senderKey.signingKeyPublic);

  // Verify signature (covers nonce + ciphertext)
  if (!ed25519Verify(sigPub, concatBytes(ncBytes, ctBytes), sigBytes)) {
    throw new Error('V1 SK: Invalid signature');
  }

  const iteration = envelope.iter;
  if (!Number.isInteger(iteration) || iteration < 0 || iteration > MAX_ITERATION) {
    throw new Error('V1 SK: Invalid iteration');
  }

  // AAD binding
  const aad = new TextEncoder().encode(JSON.stringify({ roomId, senderId: senderUserId }));

  // Initialize skipped keys cache if needed
  if (!senderKey.skippedKeys) senderKey.skippedKeys = {};

  // Try skipped keys first (out-of-order message)
  const skipKey = String(iteration);
  if (senderKey.skippedKeys[skipKey]) {
    const mk = fromBase64(senderKey.skippedKeys[skipKey]);
    const plaintext = aes256GcmDecrypt(mk, ctBytes, ncBytes, aad);
    delete senderKey.skippedKeys[skipKey];
    mk.fill(0);
    await keyStore.saveSenderKey(roomId, envelope.skid, senderKey);
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    return { body: payload.body, attachments: payload.attachments || [], ts: payload.ts };
  }

  // Derive forward
  const targetIter = iteration + 1;
  const gap = targetIter - senderKey.iteration;
  if (gap > MAX_SENDER_KEY_SKIP) throw new Error(`V1 SK: gap ${gap} exceeds max`);
  if (gap < 1) throw new Error('V1 SK: iteration already consumed');

  const savedChainKey = senderKey.chainKey;
  const savedIteration = senderKey.iteration;
  const savedSkipped = { ...senderKey.skippedKeys };

  try {
    let ck = fromBase64(senderKey.chainKey);
    for (let i = senderKey.iteration; i <= iteration; i++) {
      const advanced = hmacSha256(ck, new Uint8Array([0x01]));
      ck.fill(0);
      if (i < iteration) {
        const skippedMk = hmacSha256(advanced, new Uint8Array([0x02]));
        senderKey.skippedKeys[String(i)] = toBase64(skippedMk);
        skippedMk.fill(0);
        ck = hmacSha256(advanced, new Uint8Array([0x01]));
        advanced.fill(0);
      } else {
        ck = advanced;
      }
    }

    const messageKey = hmacSha256(ck, new Uint8Array([0x02]));
    const newChainKey = hmacSha256(ck, new Uint8Array([0x01]));
    const plaintext = aes256GcmDecrypt(messageKey, ctBytes, ncBytes, aad);

    senderKey.chainKey = toBase64(newChainKey);
    senderKey.iteration = iteration + 1;
    messageKey.fill(0);

    // Evict old skipped keys
    const skippedEntries = Object.keys(senderKey.skippedKeys);
    if (skippedEntries.length > MAX_SENDER_KEY_SKIP) {
      for (let i = 0; i < skippedEntries.length - MAX_SENDER_KEY_SKIP; i++) {
        delete senderKey.skippedKeys[skippedEntries[i]];
      }
    }

    await keyStore.saveSenderKey(roomId, envelope.skid, senderKey);
    const payload = JSON.parse(new TextDecoder().decode(plaintext));
    return { body: payload.body, attachments: payload.attachments || [], ts: payload.ts };
  } catch (err) {
    senderKey.chainKey = savedChainKey;
    senderKey.iteration = savedIteration;
    senderKey.skippedKeys = savedSkipped;
    throw err;
  }
}
