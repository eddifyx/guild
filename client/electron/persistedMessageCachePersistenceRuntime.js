const {
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  encodePersistenceSegment,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('./persistedMessageCacheModel');
const {
  createPersistedMessageCacheLoadRuntime,
  deserializeMessageCache,
} = require('./persistedMessageCacheLoadRuntime');
const {
  createPersistedMessageCacheFlushRuntime,
} = require('./persistedMessageCacheFlushRuntime');

function createPersistedMessageCachePersistenceRuntime({
  app,
  fs,
  path,
  logger = console,
  nowFn = Date.now,
  clearTimeoutFn = clearTimeout,
  messageCacheLimit = MESSAGE_CACHE_LIMIT,
  messageCacheTtlMs = MESSAGE_CACHE_TTL_MS,
  messageCacheStates = new Map(),
}) {
  function pruneEntries(entries) {
    return pruneMessageCacheEntries(entries, {
      now: nowFn,
      limit: messageCacheLimit,
      ttlMs: messageCacheTtlMs,
    });
  }

  const { loadMessageCacheState } = createPersistedMessageCacheLoadRuntime({
    app,
    fs,
    path,
    logger,
    messageCacheStates,
    pruneEntries,
  });

  const {
    flushAllMessageCacheStates,
    flushMessageCacheState,
  } = createPersistedMessageCacheFlushRuntime({
    fs,
    logger,
    clearTimeoutFn,
    messageCacheStates,
    pruneEntries,
  });

  return {
    flushAllMessageCacheStates,
    flushMessageCacheState,
    loadMessageCacheState,
    messageCacheStates,
    pruneEntries,
  };
}

module.exports = {
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createPersistedMessageCachePersistenceRuntime,
  deserializeMessageCache,
  encodePersistenceSegment,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
};
