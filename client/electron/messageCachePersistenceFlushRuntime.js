function createMessageCachePersistenceFlushRuntime({
  fs,
  logger = console,
  clearTimeoutFn = clearTimeout,
  messageCacheStates = new Map(),
  pruneEntries,
  serialize,
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
      const serialized = serialize(state.entries);
      if (!serialized) {
        try {
          if (fs.existsSync(state.filePath)) {
            fs.rmSync(state.filePath, { force: true });
          }
        } catch (err) {
          logger.warn('[MessageCache] Failed to remove unprotected cache file:', err?.message || err);
        }
        state.dirty = false;
        return;
      }

      fs.writeFileSync(state.filePath, serialized, {
        encoding: 'utf8',
        mode: 0o600,
      });
      try {
        fs.chmodSync(state.filePath, 0o600);
      } catch {}
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
  createMessageCachePersistenceFlushRuntime,
};
