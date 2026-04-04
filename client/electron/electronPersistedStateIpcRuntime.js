function registerPersistedStateIpcHandlers({
  clearAuthBackup,
  clearSignerState,
  deleteMessageCacheEntry,
  getMessageCacheEntry,
  getManyMessageCacheEntries,
  getRoomSnapshotEntry,
  ipcMain,
  logger = console,
  readAuthBackup,
  readSignerState,
  requireTrustedSender,
  setMessageCacheEntry,
  setRoomSnapshotEntry,
  writeAuthBackup,
  writeSignerState,
}) {
  ipcMain.handle('message-cache:get', (event, userId, messageId) => {
    requireTrustedSender(event, 'message-cache:get');
    return getMessageCacheEntry(userId, messageId);
  });
  ipcMain.handle('message-cache:get-many', (event, userId, messageIds) => {
    requireTrustedSender(event, 'message-cache:get-many');
    if (typeof getManyMessageCacheEntries === 'function') {
      return getManyMessageCacheEntries(userId, messageIds);
    }
    if (!Array.isArray(messageIds)) {
      return [];
    }
    return messageIds.map((messageId) => getMessageCacheEntry(userId, messageId));
  });
  ipcMain.handle('message-cache:set', (event, userId, messageId, entry) => {
    requireTrustedSender(event, 'message-cache:set');
    return setMessageCacheEntry(userId, messageId, entry);
  });
  ipcMain.handle('message-cache:delete', (event, userId, messageId) => {
    requireTrustedSender(event, 'message-cache:delete');
    return deleteMessageCacheEntry(userId, messageId);
  });

  if (typeof getRoomSnapshotEntry === 'function') {
    ipcMain.handle('room-snapshot:get', (event, userId, roomId) => {
      requireTrustedSender(event, 'room-snapshot:get');
      return getRoomSnapshotEntry(userId, roomId);
    });
  }

  if (typeof setRoomSnapshotEntry === 'function') {
    ipcMain.handle('room-snapshot:set', (event, userId, roomId, snapshot) => {
      requireTrustedSender(event, 'room-snapshot:set');
      return setRoomSnapshotEntry(userId, roomId, snapshot);
    });
  }

  ipcMain.on('auth-state:get-sync', (event) => {
    try {
      requireTrustedSender(event, 'auth-state:get-sync');
      event.returnValue = readAuthBackup();
    } catch (err) {
      logger.warn('[AuthBackup] Blocked untrusted auth-state:get-sync request:', err?.message || err);
      event.returnValue = null;
    }
  });
  ipcMain.handle('auth-state:set', (event, authData) => {
    requireTrustedSender(event, 'auth-state:set');
    return writeAuthBackup(authData);
  });
  ipcMain.handle('auth-state:clear', (event) => {
    requireTrustedSender(event, 'auth-state:clear');
    return clearAuthBackup();
  });

  if (typeof readSignerState === 'function') {
    ipcMain.handle('signer-state:get', (event) => {
      requireTrustedSender(event, 'signer-state:get');
      return readSignerState();
    });
  }

  if (typeof writeSignerState === 'function') {
    ipcMain.handle('signer-state:set', (event, signerState) => {
      requireTrustedSender(event, 'signer-state:set');
      return writeSignerState(signerState);
    });
  }

  if (typeof clearSignerState === 'function') {
    ipcMain.handle('signer-state:clear', (event) => {
      requireTrustedSender(event, 'signer-state:clear');
      return clearSignerState();
    });
  }
}

module.exports = {
  registerPersistedStateIpcHandlers,
};
