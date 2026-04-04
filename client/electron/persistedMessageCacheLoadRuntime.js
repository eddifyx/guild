const {
  deserializeMessageCache,
  getMessageCacheFilePath,
} = require('./persistedMessageCacheModel');

function createPersistedMessageCacheLoadRuntime({
  app,
  fs,
  path,
  logger = console,
  messageCacheStates = new Map(),
  pruneEntries,
}) {
  function loadMessageCacheState(userId) {
    const key = String(userId || '');
    if (!key) return null;

    const existing = messageCacheStates.get(key);
    if (existing) return existing;

    let entries = {};
    let dirty = false;
    const filePath = getMessageCacheFilePath({
      app,
      fs,
      path,
      userId: key,
    });

    if (fs.existsSync(filePath)) {
      try {
        entries = deserializeMessageCache(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        logger.warn('[MessageCache] Failed to read persisted cache:', err?.message || err);
        entries = {};
        dirty = true;
      }
    }

    const prunedEntries = pruneEntries(entries);
    if (Object.keys(prunedEntries).length !== Object.keys(entries || {}).length) {
      entries = prunedEntries;
      dirty = true;
    } else {
      entries = prunedEntries;
    }

    const state = {
      userId: key,
      filePath,
      entries,
      dirty,
      flushTimer: null,
    };

    messageCacheStates.set(key, state);
    return state;
  }

  return {
    loadMessageCacheState,
  };
}

module.exports = {
  createPersistedMessageCacheLoadRuntime,
  deserializeMessageCache,
  getMessageCacheFilePath,
};
