const {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  encodePersistenceSegment,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
} = require('./roomSnapshotCacheModel');
const {
  createRoomSnapshotCacheLoadRuntime,
} = require('./roomSnapshotCacheLoadRuntime');
const {
  createRoomSnapshotCacheFlushRuntime,
} = require('./roomSnapshotCacheFlushRuntime');

function createRoomSnapshotCachePersistenceRuntime({
  app,
  fs,
  path,
  logger = console,
  nowFn = Date.now,
  clearTimeoutFn = clearTimeout,
  roomSnapshotLimit = ROOM_SNAPSHOT_LIMIT,
  roomSnapshotMessageLimit = ROOM_SNAPSHOT_MESSAGE_LIMIT,
  roomSnapshotTtlMs = ROOM_SNAPSHOT_TTL_MS,
  roomSnapshotStates = new Map(),
}) {
  function pruneEntries(entries) {
    return pruneRoomSnapshotEntries(entries, {
      now: nowFn,
      limit: roomSnapshotLimit,
      messageLimit: roomSnapshotMessageLimit,
      ttlMs: roomSnapshotTtlMs,
    });
  }

  const { loadRoomSnapshotState } = createRoomSnapshotCacheLoadRuntime({
    app,
    fs,
    path,
    logger,
    roomSnapshotStates,
    pruneEntries,
  });

  const {
    flushAllRoomSnapshotStates,
    flushRoomSnapshotState,
  } = createRoomSnapshotCacheFlushRuntime({
    fs,
    logger,
    clearTimeoutFn,
    roomSnapshotStates,
    pruneEntries,
  });

  return {
    flushAllRoomSnapshotStates,
    flushRoomSnapshotState,
    loadRoomSnapshotState,
    pruneEntries,
    roomSnapshotStates,
  };
}

module.exports = {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  createRoomSnapshotCachePersistenceRuntime,
  encodePersistenceSegment,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
};
