const MAX_PENDING_CONTROL_AGE_MS = 60_000;
const CONTROL_RETRY_INTERVAL_MS = 1_000;

function defaultSetInterval(fn, delayMs) {
  return globalThis.setInterval(fn, delayMs);
}

function defaultClearInterval(timerId) {
  globalThis.clearInterval(timerId);
}

function defaultWarn(...args) {
  globalThis.console?.warn?.(...args);
}

export function createSocketPendingControlQueueRuntime({
  processEncryptedControlMessageFn = async () => ({ handled: false }),
  acknowledgeProcessedControlMessageFn = async () => {},
  nowFn = () => Date.now(),
  setIntervalFn = defaultSetInterval,
  clearIntervalFn = defaultClearInterval,
  warnFn = defaultWarn,
} = {}) {
  const pendingControlMessages = [];
  let pendingRetryTimer = null;

  function stopPendingRetryLoop() {
    if (!pendingRetryTimer) return;
    clearIntervalFn(pendingRetryTimer);
    pendingRetryTimer = null;
  }

  function startPendingRetryLoop() {
    if (pendingRetryTimer) return;
    pendingRetryTimer = setIntervalFn(() => {
      flushPendingControlMessages().catch(() => {});
    }, CONTROL_RETRY_INTERVAL_MS);
  }

  function queuePendingControlMessage(entry) {
    const existing = pendingControlMessages.find(
      (item) => item.fromUserId === entry.fromUserId && item.envelope === entry.envelope,
    );
    if (existing) {
      existing.attempts += 1;
      existing.lastError = entry.lastError || existing.lastError;
      return;
    }

    pendingControlMessages.push({
      ...entry,
      receivedAt: entry.receivedAt || nowFn(),
      attempts: entry.attempts || 1,
    });
    startPendingRetryLoop();
  }

  async function flushPendingControlMessages() {
    if (pendingControlMessages.length === 0) {
      stopPendingRetryLoop();
      return;
    }

    const now = nowFn();
    const queued = pendingControlMessages.splice(0, pendingControlMessages.length);

    for (const entry of queued) {
      if (now - entry.receivedAt > MAX_PENDING_CONTROL_AGE_MS) {
        warnFn('[E2E] Dropping expired pending control message:', entry.lastError || 'timed out');
        continue;
      }

      try {
        const result = await processEncryptedControlMessageFn(entry);
        await acknowledgeProcessedControlMessageFn(entry, result);
      } catch (err) {
        if (err?.retryable) {
          queuePendingControlMessage({
            ...entry,
            receivedAt: entry.receivedAt,
            attempts: entry.attempts + 1,
            lastError: err.message,
          });
        } else {
          await acknowledgeProcessedControlMessageFn(entry, null, err);
          warnFn('[E2E] Failed to process encrypted control message:', err?.message || err);
        }
      }
    }

    if (pendingControlMessages.length === 0) {
      stopPendingRetryLoop();
    }
  }

  function handleSocketConnect() {
    if (pendingControlMessages.length > 0) {
      flushPendingControlMessages().catch(() => {});
    }
  }

  function reset() {
    stopPendingRetryLoop();
    pendingControlMessages.length = 0;
  }

  function getStateSnapshot() {
    return {
      pendingControlMessageCount: pendingControlMessages.length,
      retryLoopActive: pendingRetryTimer != null,
    };
  }

  return {
    clearPendingControlMessages: reset,
    flushPendingControlMessages,
    flushPendingControlMessagesNow: flushPendingControlMessages,
    getStateSnapshot,
    handleSocketConnect,
    queuePendingControlMessage,
    reset,
  };
}
