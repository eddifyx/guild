const {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createMessageCachePersistenceStateRuntime,
  deserializeMessageCache,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('./messageCachePersistenceStateRuntime');

function createMessageCachePersistenceRuntime({
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
  return createMessageCachePersistenceStateRuntime({
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
    messageCacheStates,
  });
}

module.exports = {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createMessageCachePersistenceRuntime,
  deserializeMessageCache,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
};
