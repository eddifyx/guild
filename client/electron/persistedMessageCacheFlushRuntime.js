const { serializeMessageCache } = require('./persistedMessageCacheModel');

function createPersistedMessageCacheFlushRuntime({
  fs,
  logger = console,
  clearTimeoutFn = clearTimeout,
  messageCacheStates = new Map(),
  pruneEntries,
}) {
  function flushMessageCacheState(userId) {
    const key = String(userId || '');
    const state = key ? messageCacheStates.get(key) : null;
    if (!state || !state.dirty) return;

    if (state.flushTimer) {
      clearTimeoutFn(state.flushTimer);
      state.flushTimer = null;
    }

    state.entries = pruneEntries(state.entries);

    try {
      fs.writeFileSync(state.filePath, serializeMessageCache(state.entries), 'utf8');
      state.dirty = false;
    } catch (err) {
      logger.warn('[MessageCache] Failed to flush persisted cache:', err?.message || err);
    }
  }

  function flushAllMessageCacheStates() {
    for (const userId of messageCacheStates.keys()) {
      flushMessageCacheState(userId);
    }
  }

  return {
    flushAllMessageCacheStates,
    flushMessageCacheState,
  };
}

module.exports = {
  createPersistedMessageCacheFlushRuntime,
  serializeMessageCache,
};
