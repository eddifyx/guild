const ROOM_SENDER_KEY_REQUEST_TIMEOUT_MS = 5_000;

function defaultWarn(...args) {
  globalThis.console?.warn?.(...args);
}

function defaultSetTimeout(fn, delayMs) {
  const timeoutApi = globalThis.window?.setTimeout?.bind(globalThis.window) || globalThis.setTimeout;
  return timeoutApi(fn, delayMs);
}

function defaultClearTimeout(timerId) {
  const clearTimeoutApi = globalThis.window?.clearTimeout?.bind(globalThis.window) || globalThis.clearTimeout;
  clearTimeoutApi(timerId);
}

async function importSessionManager() {
  return import('../../crypto/sessionManager.js');
}

export function createSocketRoomSenderKeyRuntime({
  apiRequestFn = async () => null,
  importSessionManagerFn = importSessionManager,
  processEncryptedControlMessageFn = async () => ({ handled: false }),
  queuePendingControlMessageFn = () => {},
  shouldAcknowledgeSenderKeyErrorFn = () => false,
  acknowledgeSenderKeyReceiptsFn = async () => {},
  nowFn = () => Date.now(),
  setTimeoutFn = defaultSetTimeout,
  clearTimeoutFn = defaultClearTimeout,
  warnFn = defaultWarn,
} = {}) {
  const pendingRoomSenderKeySyncs = new Map();
  const pendingRoomSenderKeyRequests = new Map();

  function clearPendingRoomSenderKeyRequests() {
    for (const [key, entry] of pendingRoomSenderKeyRequests.entries()) {
      if (entry?.settled) {
        pendingRoomSenderKeyRequests.delete(key);
        continue;
      }
      entry.settled = true;
      clearTimeoutFn(entry.timeoutId);
      pendingRoomSenderKeyRequests.delete(key);
      entry.resolve(false);
    }
  }

  async function syncRoomSenderKeys(roomId, { includeDelivered = false, limit = 32 } = {}) {
    if (!roomId) return 0;
    const syncKey = `${roomId}:${includeDelivered ? 'delivered' : 'pending'}`;
    if (pendingRoomSenderKeySyncs.has(syncKey)) {
      return pendingRoomSenderKeySyncs.get(syncKey);
    }

    const syncPromise = (async () => {
      const { isE2EInitialized } = await importSessionManagerFn();
      if (!isE2EInitialized()) return 0;

      let pending = [];
      try {
        const query = includeDelivered
          ? `?includeDelivered=1&limit=${Math.min(Math.max(Number(limit) || 32, 1), 100)}`
          : '';
        pending = await apiRequestFn(`/api/rooms/${encodeURIComponent(roomId)}/sender-keys${query}`);
      } catch (err) {
        warnFn('[E2E] Failed to fetch stored sender keys:', err?.message || err);
        return 0;
      }
      if (!Array.isArray(pending) || pending.length === 0) return 0;

      const ackIds = [];
      for (const entry of pending) {
        const queuedEntry = {
          ...entry,
          roomId: entry?.roomId || roomId,
          receivedAt: nowFn(),
        };
        try {
          const result = await processEncryptedControlMessageFn(queuedEntry);
          if (result?.type === 'sender_key_distribution' && entry?.id) {
            ackIds.push(entry.id);
          }
        } catch (err) {
          if (err?.retryable) {
            queuePendingControlMessageFn({
              ...queuedEntry,
              lastError: err?.message || 'Processing failed',
            });
            continue;
          }
          if (entry?.id && shouldAcknowledgeSenderKeyErrorFn(err)) {
            ackIds.push(entry.id);
          } else {
            warnFn('[E2E] Failed to sync stored sender key:', err?.message || err);
          }
        }
      }

      if (ackIds.length > 0) {
        await acknowledgeSenderKeyReceiptsFn(roomId, ackIds);
      }

      return ackIds.length;
    })().finally(() => {
      pendingRoomSenderKeySyncs.delete(syncKey);
    });

    pendingRoomSenderKeySyncs.set(syncKey, syncPromise);
    return syncPromise;
  }

  function requestRoomSenderKey({ socket = null, roomId, senderUserId }) {
    if (!roomId || !senderUserId || !socket) return false;
    const key = `${roomId}:${senderUserId}`;
    if (pendingRoomSenderKeyRequests.has(key)) {
      return pendingRoomSenderKeyRequests.get(key).promise;
    }

    const entry = {
      settled: false,
      timeoutId: null,
      resolve: () => {},
      promise: null,
    };

    const settle = (value) => {
      if (entry.settled) return;
      entry.settled = true;
      clearTimeoutFn(entry.timeoutId);
      pendingRoomSenderKeyRequests.delete(key);
      entry.resolve(!!value);
    };

    entry.promise = new Promise((resolve) => {
      entry.resolve = resolve;
      entry.timeoutId = setTimeoutFn(() => settle(false), ROOM_SENDER_KEY_REQUEST_TIMEOUT_MS);
      socket.emit('room:request_sender_key', { roomId, senderUserId }, (response) => {
        settle(!!response?.ok);
      });
    });

    pendingRoomSenderKeyRequests.set(key, entry);
    return entry.promise;
  }

  function getStateSnapshot() {
    return {
      pendingRoomSenderKeySyncCount: pendingRoomSenderKeySyncs.size,
      pendingRoomSenderKeyRequestCount: pendingRoomSenderKeyRequests.size,
    };
  }

  return {
    clearPendingRoomSenderKeyRequests,
    getStateSnapshot,
    requestRoomSenderKey,
    syncRoomSenderKeys,
  };
}
