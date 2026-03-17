import { io } from 'socket.io-client';
import { api, getServerUrl } from './api';

let socket = null;
const pendingControlMessages = [];
let pendingRetryTimer = null;
const MAX_PENDING_CONTROL_AGE_MS = 60_000;
const CONTROL_RETRY_INTERVAL_MS = 1_000;
const pendingRoomSenderKeySyncs = new Map();
const pendingRoomSenderKeyRequests = new Map();

function stopPendingRetryLoop() {
  if (!pendingRetryTimer) return;
  clearInterval(pendingRetryTimer);
  pendingRetryTimer = null;
}

function startPendingRetryLoop() {
  if (pendingRetryTimer) return;
  pendingRetryTimer = setInterval(() => {
    flushPendingControlMessages().catch(() => {});
  }, CONTROL_RETRY_INTERVAL_MS);
}

function queuePendingControlMessage(entry) {
  const existing = pendingControlMessages.find(
    item => item.fromUserId === entry.fromUserId && item.envelope === entry.envelope
  );
  if (existing) {
    existing.attempts += 1;
    existing.lastError = entry.lastError || existing.lastError;
    return;
  }

  pendingControlMessages.push({
    ...entry,
    receivedAt: entry.receivedAt || Date.now(),
    attempts: entry.attempts || 1,
  });
  startPendingRetryLoop();
}

async function processEncryptedControlMessage({ fromUserId, senderNpub, envelope }) {
  const { isE2EInitialized } = await import('./crypto/sessionManager.js');
  if (!isE2EInitialized()) {
    const err = new Error('E2E not initialized yet');
    err.retryable = true;
    throw err;
  }

  if (senderNpub) {
    const { rememberUserNpub } = await import('./crypto/identityDirectory.js');
    rememberUserNpub(fromUserId, senderNpub);
  }

  const { decryptDirectMessage } = await import('./crypto/messageEncryption.js');
  const decrypted = await decryptDirectMessage(fromUserId, envelope);
  const payload = JSON.parse(decrypted.body);

  if (payload.type === 'sender_key_distribution') {
    const { processDecryptedSenderKey } = await import('./crypto/senderKeys.js');
    await processDecryptedSenderKey(fromUserId, payload);
    window.dispatchEvent(new CustomEvent('sender-key-updated', {
      detail: { roomId: payload.roomId, senderUserId: fromUserId },
    }));
    return {
      handled: true,
      type: payload.type,
      roomId: payload.roomId || null,
    };
  }

  if (payload.type === 'voice_key_distribution') {
    const { processDecryptedVoiceKey } = await import('./crypto/voiceEncryption.js');
    const applied = await processDecryptedVoiceKey(fromUserId, payload);
    if (applied) {
      window.dispatchEvent(new CustomEvent('voice-key-updated', {
        detail: {
          channelId: payload.channelId,
          epoch: payload.epoch,
          fromUserId,
        },
      }));
    }
    return {
      handled: applied,
      type: payload.type,
      channelId: payload.channelId || null,
    };
  }

  return {
    handled: false,
    type: payload.type || 'unknown',
  };
}

function shouldAcknowledgeSenderKeyError(err) {
  const message = String(err?.message || '');
  return message.includes('DuplicatedMessage')
    || message.includes('old counter')
    || message.includes('rollback rejected');
}

async function acknowledgeSenderKeyReceipts(roomId, ids) {
  if (!roomId || !Array.isArray(ids) || ids.length === 0) return;
  try {
    await api(`/api/rooms/${encodeURIComponent(roomId)}/sender-keys/ack`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
  } catch (err) {
    console.warn('[E2E] Failed to acknowledge sender key receipt:', err?.message || err);
  }
}

async function acknowledgeProcessedControlMessage(entry, result, err = null) {
  const roomId = entry?.roomId || result?.roomId || null;
  if (!entry?.id || !roomId) return;
  if (err && !shouldAcknowledgeSenderKeyError(err)) return;
  if (!err && result?.type !== 'sender_key_distribution') return;
  await acknowledgeSenderKeyReceipts(roomId, [entry.id]);
}

async function flushPendingControlMessages() {
  if (pendingControlMessages.length === 0) {
    stopPendingRetryLoop();
    return;
  }

  const now = Date.now();
  const queued = pendingControlMessages.splice(0, pendingControlMessages.length);

  for (const entry of queued) {
    if (now - entry.receivedAt > MAX_PENDING_CONTROL_AGE_MS) {
      console.warn('[E2E] Dropping expired pending control message:', entry.lastError || 'timed out');
      continue;
    }

    try {
      const result = await processEncryptedControlMessage(entry);
      await acknowledgeProcessedControlMessage(entry, result);
    } catch (err) {
      if (err?.retryable) {
        queuePendingControlMessage({
          ...entry,
          receivedAt: entry.receivedAt,
          attempts: entry.attempts + 1,
          lastError: err.message,
        });
      } else {
        await acknowledgeProcessedControlMessage(entry, null, err);
        console.warn('[E2E] Failed to process encrypted control message:', err?.message || err);
      }
    }
  }

  if (pendingControlMessages.length === 0) {
    stopPendingRetryLoop();
  }
}

export async function flushPendingControlMessagesNow() {
  await flushPendingControlMessages();
}

export async function syncRoomSenderKeys(roomId, { includeDelivered = false, limit = 32 } = {}) {
  if (!roomId) return 0;
  const syncKey = `${roomId}:${includeDelivered ? 'delivered' : 'pending'}`;
  if (pendingRoomSenderKeySyncs.has(syncKey)) {
    return pendingRoomSenderKeySyncs.get(syncKey);
  }

  const syncPromise = (async () => {
    const { isE2EInitialized } = await import('./crypto/sessionManager.js');
    if (!isE2EInitialized()) return 0;

    let pending = [];
    try {
      const query = includeDelivered
        ? `?includeDelivered=1&limit=${Math.min(Math.max(Number(limit) || 32, 1), 100)}`
        : '';
      pending = await api(`/api/rooms/${encodeURIComponent(roomId)}/sender-keys${query}`);
    } catch (err) {
      console.warn('[E2E] Failed to fetch stored sender keys:', err?.message || err);
      return 0;
    }
    if (!Array.isArray(pending) || pending.length === 0) return 0;

    const ackIds = [];
    for (const entry of pending) {
      const queuedEntry = {
        ...entry,
        roomId: entry?.roomId || roomId,
        receivedAt: Date.now(),
      };
      try {
        const result = await processEncryptedControlMessage(queuedEntry);
        if (result?.type === 'sender_key_distribution' && entry?.id) {
          ackIds.push(entry.id);
        }
      } catch (err) {
        if (err?.retryable) {
          queuePendingControlMessage({
            ...queuedEntry,
            lastError: err?.message || 'Processing failed',
          });
          continue;
        }
        if (entry?.id && shouldAcknowledgeSenderKeyError(err)) {
          ackIds.push(entry.id);
        } else {
          console.warn('[E2E] Failed to sync stored sender key:', err?.message || err);
        }
      }
    }

    if (ackIds.length > 0) {
      await acknowledgeSenderKeyReceipts(roomId, ackIds);
    }

    return ackIds.length;
  })().finally(() => {
    pendingRoomSenderKeySyncs.delete(syncKey);
  });

  pendingRoomSenderKeySyncs.set(syncKey, syncPromise);
  return syncPromise;
}

export async function requestRoomSenderKey(roomId, senderUserId) {
  if (!roomId || !senderUserId || !socket) return false;
  const key = `${roomId}:${senderUserId}`;
  if (pendingRoomSenderKeyRequests.has(key)) {
    return pendingRoomSenderKeyRequests.get(key);
  }

  const requestPromise = new Promise((resolve) => {
    socket.emit('room:request_sender_key', { roomId, senderUserId }, (response) => {
      resolve(!!response?.ok);
    });
  }).finally(() => {
    pendingRoomSenderKeyRequests.delete(key);
  });

  pendingRoomSenderKeyRequests.set(key, requestPromise);
  return requestPromise;
}

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(getServerUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  // Listen for incoming sender key and voice key distributions.
  // Route through the validated processing functions, not inline handlers.
  socket.on('dm:sender_key', async ({ id, fromUserId, senderNpub, envelope, roomId, distributionId }) => {
    try {
      const entry = { id, fromUserId, senderNpub, envelope, roomId, distributionId };
      const result = await processEncryptedControlMessage(entry);
      await acknowledgeProcessedControlMessage(entry, result);
    } catch (err) {
      queuePendingControlMessage({
        id,
        fromUserId,
        senderNpub,
        envelope,
        roomId,
        distributionId,
        lastError: err?.message || 'Processing failed',
      });
    }
  });

  // Listen for room member removal and re-key sender keys for forward secrecy.
  socket.on('room:member_removed', async ({ roomId }) => {
    try {
      const { isE2EInitialized } = await import('./crypto/sessionManager.js');
      if (!isE2EInitialized()) return;

      const { rekeyRoom } = await import('./crypto/senderKeys.js');
      await rekeyRoom(roomId);
    } catch (err) {
      // Rekey failure is non-fatal; the next message send will try again.
    }
  });

  socket.on('room:sender_key_requested', async ({ roomId }) => {
    try {
      const { isE2EInitialized } = await import('./crypto/sessionManager.js');
      if (!isE2EInitialized()) return;

      const { redistributeSenderKey } = await import('./crypto/senderKeys.js');
      await redistributeSenderKey(roomId);
    } catch (err) {
      console.warn('[E2E] Failed to redistribute sender key on request:', err?.message || err);
    }
  });

  socket.on('connect', () => {
    if (pendingControlMessages.length > 0) {
      flushPendingControlMessages().catch(() => {});
    }
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  stopPendingRetryLoop();
  pendingControlMessages.length = 0;
  pendingRoomSenderKeySyncs.clear();
  pendingRoomSenderKeyRequests.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
