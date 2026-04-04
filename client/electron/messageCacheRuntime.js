const {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createMessageCachePersistenceRuntime,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
} = require('./messageCachePersistenceRuntime');

function createMessageCacheRuntime({
  app,
  fs,
  path,
  safeStorage,
  logger = console,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  nowFn = Date.now,
  dirName = MESSAGE_CACHE_DIR_NAME,
  limit = MESSAGE_CACHE_LIMIT,
  ttlMs = MESSAGE_CACHE_TTL_MS,
} = {}) {
  const {
    flushAllMessageCacheStates,
    flushMessageCacheState,
    loadMessageCacheState,
    pruneEntries,
    scheduleMessageCacheFlush,
  } = createMessageCachePersistenceRuntime({
    app,
    fs,
    path,
    safeStorage,
    logger,
    setTimeoutFn,
    clearTimeoutFn,
    nowFn,
    dirName,
    limit,
    ttlMs,
  });

  function getMessageCacheEntry(userId, messageId) {
    const state = loadMessageCacheState(userId);
    if (!state || !messageId) return null;

    const entry = state.entries[messageId];
    if (!entry) return null;

    if (nowFn() - (entry.cachedAt || 0) > ttlMs) {
      delete state.entries[messageId];
      state.dirty = true;
      flushMessageCacheState(userId);
      return null;
    }

    return entry;
  }

  function getManyMessageCacheEntries(userId, messageIds) {
    const state = loadMessageCacheState(userId);
    if (!state || !Array.isArray(messageIds) || messageIds.length === 0) return {};

    const results = {};
    let dirty = false;
    const uniqueIds = Array.from(new Set(
      messageIds.filter((messageId) => typeof messageId === 'string' && messageId)
    ));

    for (const messageId of uniqueIds) {
      const entry = state.entries[messageId];
      if (!entry) continue;

      if (nowFn() - (entry.cachedAt || 0) > ttlMs) {
        delete state.entries[messageId];
        dirty = true;
        continue;
      }

      results[messageId] = entry;
    }

    if (dirty) {
      state.dirty = true;
      flushMessageCacheState(userId);
    }

    return results;
  }

  function setMessageCacheEntry(userId, messageId, entry) {
    const state = loadMessageCacheState(userId);
    if (!state || !messageId || !entry || typeof entry !== 'object') return false;

    state.entries[messageId] = normalizeMessageCacheEntry(entry, { now: nowFn });
    state.entries = pruneEntries(state.entries);
    state.dirty = true;
    flushMessageCacheState(userId);
    return true;
  }

  function deleteMessageCacheEntry(userId, messageId) {
    const state = loadMessageCacheState(userId);
    if (!state || !messageId) return false;
    if (!state.entries[messageId]) return false;

    delete state.entries[messageId];
    state.dirty = true;
    flushMessageCacheState(userId);
    return true;
  }

  return {
    loadMessageCacheState,
    flushMessageCacheState,
    scheduleMessageCacheFlush,
    flushAllMessageCacheStates,
    getMessageCacheEntry,
    getManyMessageCacheEntries,
    setMessageCacheEntry,
    deleteMessageCacheEntry,
  };
}

module.exports = {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createMessageCacheRuntime,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
};
