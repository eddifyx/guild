const {
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createPersistedMessageCachePersistenceRuntime,
  deserializeMessageCache,
  encodePersistenceSegment,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('./persistedMessageCachePersistenceRuntime');

function createPersistedMessageCacheRuntime({
  app,
  fs,
  path,
  logger = console,
  nowFn = Date.now,
  clearTimeoutFn = clearTimeout,
  messageCacheLimit = MESSAGE_CACHE_LIMIT,
  messageCacheTtlMs = MESSAGE_CACHE_TTL_MS,
}) {
  const {
    flushAllMessageCacheStates,
    flushMessageCacheState,
    loadMessageCacheState,
    pruneEntries,
  } = createPersistedMessageCachePersistenceRuntime({
    app,
    fs,
    path,
    logger,
    nowFn,
    clearTimeoutFn,
    messageCacheLimit,
    messageCacheTtlMs,
  });

  function getMessageCacheEntry(userId, messageId) {
    const state = loadMessageCacheState(userId);
    if (!state || !messageId) return null;

    const entry = state.entries[messageId];
    if (!entry) return null;

    if (nowFn() - (entry.cachedAt || 0) > messageCacheTtlMs) {
      delete state.entries[messageId];
      state.dirty = true;
      flushMessageCacheState(userId);
      return null;
    }

    return entry;
  }

  function getManyMessageCacheEntries(userId, messageIds) {
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return [];
    }

    return messageIds.map((messageId) => getMessageCacheEntry(userId, messageId));
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
    if (!state || !messageId || !state.entries[messageId]) return false;

    delete state.entries[messageId];
    state.dirty = true;
    flushMessageCacheState(userId);
    return true;
  }

  return {
    deleteMessageCacheEntry,
    flushAllMessageCacheStates,
    flushMessageCacheState,
    getMessageCacheEntry,
    getManyMessageCacheEntries,
    loadMessageCacheState,
    setMessageCacheEntry,
  };
}

module.exports = {
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createPersistedMessageCacheRuntime,
  deserializeMessageCache,
  encodePersistenceSegment,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
};
