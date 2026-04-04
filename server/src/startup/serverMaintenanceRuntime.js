const path = require('path');

function removeUploadedFile(fileReference, {
  uploadsDir,
  unlinkSyncFn,
  pathModule = path,
} = {}) {
  if (!fileReference) return null;
  const filePath = pathModule.join(uploadsDir, pathModule.basename(fileReference));
  try {
    unlinkSyncFn(filePath);
  } catch {}
  return filePath;
}

function createServerMaintenanceRuntime({
  getExpiredAssetDumps,
  deleteExpiredAssetDumps,
  deleteExpiredSessions,
  getExpiredUnclaimedUploadedFiles,
  deleteExpiredUnclaimedUploadedFiles,
  getExpiredGuildChatUploadedFiles,
  deleteExpiredGuildChatUploadedFiles,
  uploadsDir,
  io,
  unlinkSyncFn,
  pathModule = path,
  logFn = console.log,
}) {
  function cleanupExpiredAssetDumps() {
    const expired = getExpiredAssetDumps.all();
    if (expired.length === 0) return 0;

    for (const asset of expired) {
      removeUploadedFile(asset.file_url, {
        uploadsDir,
        unlinkSyncFn,
        pathModule,
      });
    }

    deleteExpiredAssetDumps.run();
    io.emit('asset:expired', { assetIds: expired.map((asset) => asset.id) });
    logFn(`Cleaned up ${expired.length} expired asset dump(s)`);
    return expired.length;
  }

  function cleanupExpiredSessions() {
    deleteExpiredSessions.run();
  }

  function cleanupExpiredUnclaimedUploads() {
    const staleUploads = getExpiredUnclaimedUploadedFiles.all();
    if (staleUploads.length === 0) return 0;

    for (const upload of staleUploads) {
      removeUploadedFile(upload.stored_name, {
        uploadsDir,
        unlinkSyncFn,
        pathModule,
      });
    }

    deleteExpiredUnclaimedUploadedFiles.run();
    return staleUploads.length;
  }

  function cleanupExpiredGuildChatUploads() {
    const staleUploads = getExpiredGuildChatUploadedFiles.all();
    if (staleUploads.length === 0) return 0;

    for (const upload of staleUploads) {
      removeUploadedFile(upload.stored_name, {
        uploadsDir,
        unlinkSyncFn,
        pathModule,
      });
    }

    deleteExpiredGuildChatUploadedFiles.run();
    return staleUploads.length;
  }

  function schedule(setIntervalFn = setInterval) {
    return {
      assetDumps: setIntervalFn(cleanupExpiredAssetDumps, 10 * 60 * 1000),
      sessions: setIntervalFn(cleanupExpiredSessions, 60 * 60 * 1000),
      unclaimedUploads: setIntervalFn(cleanupExpiredUnclaimedUploads, 60 * 60 * 1000),
      guildChatUploads: setIntervalFn(cleanupExpiredGuildChatUploads, 60 * 60 * 1000),
    };
  }

  return {
    cleanupExpiredAssetDumps,
    cleanupExpiredSessions,
    cleanupExpiredUnclaimedUploads,
    cleanupExpiredGuildChatUploads,
    schedule,
  };
}

module.exports = {
  removeUploadedFile,
  createServerMaintenanceRuntime,
};
