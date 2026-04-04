function createMessageCachePersistenceLoadRuntime({
  fs,
  logger = console,
  deserialize,
  getFilePath,
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
    const filePath = getFilePath(key);

    if (fs.existsSync(filePath)) {
      try {
        const restored = deserialize(fs.readFileSync(filePath, 'utf8'));
        entries = restored.entries;
        dirty = restored.needsRewrite;
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
  createMessageCachePersistenceLoadRuntime,
};
