const {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  createRoomSnapshotCachePersistenceRuntime,
  encodePersistenceSegment,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
} = require('./roomSnapshotCachePersistenceRuntime');

function createRoomSnapshotCacheRuntime({
  app,
  fs,
  path,
  logger = console,
  nowFn = Date.now,
  clearTimeoutFn = clearTimeout,
  roomSnapshotLimit = ROOM_SNAPSHOT_LIMIT,
  roomSnapshotMessageLimit = ROOM_SNAPSHOT_MESSAGE_LIMIT,
  roomSnapshotTtlMs = ROOM_SNAPSHOT_TTL_MS,
}) {
  const {
    flushAllRoomSnapshotStates,
    flushRoomSnapshotState,
    loadRoomSnapshotState,
    pruneEntries,
  } = createRoomSnapshotCachePersistenceRuntime({
    app,
    fs,
    path,
    logger,
    nowFn,
    clearTimeoutFn,
    roomSnapshotLimit,
    roomSnapshotMessageLimit,
    roomSnapshotTtlMs,
  });

  function getRoomSnapshotEntry(userId, roomId) {
    const state = loadRoomSnapshotState(userId);
    if (!state || !roomId) return null;

    const entry = state.entries[roomId];
    if (!entry) return null;

    if (nowFn() - (entry.cachedAt || 0) > roomSnapshotTtlMs) {
      delete state.entries[roomId];
      state.dirty = true;
      flushRoomSnapshotState(userId);
      return null;
    }

    return entry;
  }

  function setRoomSnapshotEntry(userId, roomId, snapshot) {
    const state = loadRoomSnapshotState(userId);
    if (!state || !roomId || !snapshot || typeof snapshot !== 'object') return false;
    if (!Array.isArray(snapshot.messages) || snapshot.messages.length === 0) return false;

    state.entries[roomId] = {
      cachedAt: typeof snapshot.cachedAt === 'number' ? snapshot.cachedAt : nowFn(),
      hasMore: !!snapshot.hasMore,
      messages: snapshot.messages,
    };
    state.entries = pruneEntries(state.entries);
    state.dirty = true;
    flushRoomSnapshotState(userId);
    return true;
  }

  return {
    flushAllRoomSnapshotStates,
    flushRoomSnapshotState,
    getRoomSnapshotEntry,
    loadRoomSnapshotState,
    setRoomSnapshotEntry,
  };
}

module.exports = {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  createRoomSnapshotCacheRuntime,
  encodePersistenceSegment,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
};
