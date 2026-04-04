const {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  deserializeMessageCache,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('./messageCacheModel');
const {
  createMessageCachePersistenceLoadRuntime,
} = require('./messageCachePersistenceLoadRuntime');
const {
  createMessageCachePersistenceFlushRuntime,
} = require('./messageCachePersistenceFlushRuntime');

function createMessageCachePersistenceStateRuntime({
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
  messageCacheStates = new Map(),
} = {}) {
  function getFilePath(userId) {
    return getMessageCacheFilePath({
      app,
      fs,
      path,
      userId,
      dirName,
    });
  }

  function pruneEntries(entries) {
    return pruneMessageCacheEntries(entries, {
      now: nowFn,
      limit,
      ttlMs,
    });
  }

  function deserialize(raw) {
    return deserializeMessageCache(raw, { safeStorage });
  }

  function serialize(entries) {
    return serializeMessageCache(entries, { safeStorage });
  }

  const loadRuntime = createMessageCachePersistenceLoadRuntime({
    fs,
    logger,
    deserialize,
    getFilePath,
    messageCacheStates,
    pruneEntries,
  });

  const flushRuntime = createMessageCachePersistenceFlushRuntime({
    fs,
    logger,
    clearTimeoutFn,
    messageCacheStates,
    pruneEntries,
    serialize,
  });

  function scheduleMessageCacheFlush(userId) {
    const state = loadRuntime.loadMessageCacheState(userId);
    if (!state || state.flushTimer) return;

    state.flushTimer = setTimeoutFn(() => {
      flushRuntime.flushMessageCacheState(userId);
    }, 100);
    state.flushTimer?.unref?.();
  }

  return {
    deserialize,
    flushAllMessageCacheStates: flushRuntime.flushAllMessageCacheStates,
    flushMessageCacheState: flushRuntime.flushMessageCacheState,
    getFilePath,
    loadMessageCacheState: loadRuntime.loadMessageCacheState,
    messageCacheStates,
    pruneEntries,
    scheduleMessageCacheFlush,
    serialize,
  };
}

module.exports = {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createMessageCachePersistenceStateRuntime,
  deserializeMessageCache,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
};
