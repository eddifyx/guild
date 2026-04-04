function createRoomSnapshotCacheFlushRuntime({
  fs,
  logger = console,
  clearTimeoutFn = clearTimeout,
  roomSnapshotStates = new Map(),
  pruneEntries,
}) {
  function flushRoomSnapshotState(userId) {
    const key = String(userId || '');
    const state = key ? roomSnapshotStates.get(key) : null;
    if (!state || !state.dirty) return;

    if (state.flushTimer) {
      clearTimeoutFn(state.flushTimer);
      state.flushTimer = null;
    }

    state.entries = pruneEntries(state.entries);

    try {
      fs.writeFileSync(state.filePath, JSON.stringify(state.entries), 'utf8');
      state.dirty = false;
    } catch (err) {
      logger.warn('[RoomSnapshotCache] Failed to flush persisted cache:', err?.message || err);
    }
  }

  function flushAllRoomSnapshotStates() {
    for (const userId of roomSnapshotStates.keys()) {
      flushRoomSnapshotState(userId);
    }
  }

  return {
    flushAllRoomSnapshotStates,
    flushRoomSnapshotState,
  };
}

module.exports = {
  createRoomSnapshotCacheFlushRuntime,
};
