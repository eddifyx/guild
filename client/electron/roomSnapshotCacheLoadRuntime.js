const { getRoomSnapshotCacheFilePath } = require('./roomSnapshotCacheModel');

function createRoomSnapshotCacheLoadRuntime({
  app,
  fs,
  path,
  logger = console,
  roomSnapshotStates = new Map(),
  pruneEntries,
}) {
  function loadRoomSnapshotState(userId) {
    const key = String(userId || '');
    if (!key) return null;

    const existing = roomSnapshotStates.get(key);
    if (existing) return existing;

    let entries = {};
    let dirty = false;
    const filePath = getRoomSnapshotCacheFilePath({
      app,
      fs,
      path,
      userId: key,
    });

    if (fs.existsSync(filePath)) {
      try {
        entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        logger.warn('[RoomSnapshotCache] Failed to read persisted cache:', err?.message || err);
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

    roomSnapshotStates.set(key, state);
    return state;
  }

  return {
    loadRoomSnapshotState,
  };
}

module.exports = {
  createRoomSnapshotCacheLoadRuntime,
  getRoomSnapshotCacheFilePath,
};
