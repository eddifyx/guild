import { io } from 'socket.io-client';
import { getServerUrl } from './api';

let socket = null;
const pendingControlMessages = [];
let pendingRetryTimer = null;
const MAX_PENDING_CONTROL_AGE_MS = 60_000;
const CONTROL_RETRY_INTERVAL_MS = 1_000;

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
    return true;
  }

  if (payload.type === 'voice_key_distribution') {
    const { processDecryptedVoiceKey } = await import('./crypto/voiceEncryption.js');
    return await processDecryptedVoiceKey(fromUserId, payload);
  }

  return false;
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
      await processEncryptedControlMessage(entry);
    } catch (err) {
      if (err?.retryable) {
        queuePendingControlMessage({
          ...entry,
          receivedAt: entry.receivedAt,
          attempts: entry.attempts + 1,
          lastError: err.message,
        });
      } else {
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

export function connectSocket(token) {
  if (socket) socket.disconnect();
  socket = io(getServerUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  // Listen for incoming sender key and voice key distributions.
  // Route through the validated processing functions, not inline handlers.
  socket.on('dm:sender_key', async ({ fromUserId, senderNpub, envelope }) => {
    try {
      await processEncryptedControlMessage({ fromUserId, senderNpub, envelope });
    } catch (err) {
      queuePendingControlMessage({
        fromUserId,
        senderNpub,
        envelope,
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
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
