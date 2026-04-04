const {
  AUTH_BACKUP_FILE_NAME,
  createPersistedAuthBackupRuntime,
  getAuthBackupFilePath,
  normalizeAuthBackup,
} = require('./persistedAuthBackupRuntime');
const {
  SIGNER_STATE_FILE_NAME,
  createPersistedSignerStateRuntime,
  getSignerStateFilePath,
  normalizeSignerState,
} = require('./persistedSignerStateRuntime');
const {
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createPersistedMessageCacheRuntime,
  deserializeMessageCache,
  encodePersistenceSegment,
  getMessageCacheFilePath,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('./persistedMessageCacheRuntime');
const {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  createRoomSnapshotCacheRuntime,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
} = require('./roomSnapshotCacheRuntime');

function createPersistedStateRuntime({
  app,
  fs,
  path,
  logger = console,
  nowFn = Date.now,
  clearTimeoutFn = clearTimeout,
  fileName = AUTH_BACKUP_FILE_NAME,
  signerFileName = SIGNER_STATE_FILE_NAME,
  messageCacheLimit = MESSAGE_CACHE_LIMIT,
  messageCacheTtlMs = MESSAGE_CACHE_TTL_MS,
  roomSnapshotLimit = ROOM_SNAPSHOT_LIMIT,
  roomSnapshotMessageLimit = ROOM_SNAPSHOT_MESSAGE_LIMIT,
  roomSnapshotTtlMs = ROOM_SNAPSHOT_TTL_MS,
}) {
  const authBackupRuntime = createPersistedAuthBackupRuntime({
    app,
    fs,
    path,
    logger,
    fileName,
  });
  const signerStateRuntime = createPersistedSignerStateRuntime({
    app,
    fs,
    path,
    logger,
    fileName: signerFileName,
  });
  const messageCacheRuntime = createPersistedMessageCacheRuntime({
    app,
    fs,
    path,
    logger,
    nowFn,
    clearTimeoutFn,
    messageCacheLimit,
    messageCacheTtlMs,
  });
  const roomSnapshotRuntime = createRoomSnapshotCacheRuntime({
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

  return {
    ...authBackupRuntime,
    ...signerStateRuntime,
    ...messageCacheRuntime,
    ...roomSnapshotRuntime,
  };
}

module.exports = {
  AUTH_BACKUP_FILE_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  SIGNER_STATE_FILE_NAME,
  createPersistedStateRuntime,
  deserializeMessageCache,
  encodePersistenceSegment,
  getAuthBackupFilePath,
  getMessageCacheFilePath,
  getRoomSnapshotCacheFilePath,
  getSignerStateFilePath,
  normalizeAuthBackup,
  normalizeSignerState,
  pruneMessageCacheEntries,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
  serializeMessageCache,
};
