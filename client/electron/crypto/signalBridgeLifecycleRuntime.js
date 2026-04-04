function registerSignalBridgeLifecycleHandlers({
  ipcMain,
  bridgeState,
  getStore,
  setStore,
  getUserId,
  setUserId,
  bootstrapLocalIdentity,
  createProtocolStore,
  getMasterKey,
  getOrCreateLocalDeviceId,
  normalizeDeviceId,
  persistLocalDeviceId,
  clearPersistedLocalSignalState,
  createRandomDeviceId,
  resetSignalProtocolStore,
  shouldResetProtocolStore,
  logger = console,
}) {
  ipcMain.handle('signal:initialize', async (_event, uid) => {
    setUserId(uid);
    bridgeState.userId = uid;
    const currentDeviceId = getOrCreateLocalDeviceId(uid);
    const masterKeyState = getMasterKey(uid);
    let resetAttempted = false;

    while (true) {
      const masterKey = Buffer.from(masterKeyState.keyBase64, 'base64');
      const nextStore = await createProtocolStore(uid, masterKey);
      setStore(nextStore);

      try {
        let isNew = false;
        if (!nextStore.identity.hasLocalIdentity()) {
          isNew = true;
          await bootstrapLocalIdentity(nextStore);
        }

        const localIdentity = nextStore.identity.getLocalIdentityKeyPair();
        return {
          isNew,
          deviceId: currentDeviceId,
          identityKeyPublic: Buffer.from(localIdentity.publicKey.serialize()).toString('base64'),
        };
      } catch (error) {
        const canRecoverByResettingStore =
          !resetAttempted &&
          (masterKeyState.requiresStoreReset || shouldResetProtocolStore(error));

        if (!canRecoverByResettingStore) {
          throw error;
        }

        logger.warn(
          '[Signal] Resetting local Signal store after legacy keychain migration or unreadable local state:',
          error
        );
        resetAttempted = true;

        if (getStore()) {
          getStore().close();
          setStore(null);
        }
        resetSignalProtocolStore(uid);
      }
    }
  });

  ipcMain.handle('signal:destroy', async () => {
    if (getStore()) {
      getStore().close();
      setStore(null);
    }
    setUserId(null);
    bridgeState.userId = null;
    bridgeState.localDeviceId = null;
    bridgeState.localDeviceOwner = null;
  });

  ipcMain.handle('signal:reset-local-state', async (_event, uid = null) => {
    const targetUserId = uid ? String(uid) : getUserId();

    if (targetUserId && getUserId() === targetUserId && getStore()) {
      getStore().close();
      setStore(null);
    }

    clearPersistedLocalSignalState(targetUserId);

    if (targetUserId && getUserId() === targetUserId) {
      setUserId(null);
      bridgeState.userId = null;
    }

    return true;
  });

  ipcMain.handle('signal:get-device-id', async () => {
    return getOrCreateLocalDeviceId(getUserId());
  });

  ipcMain.handle('signal:set-device-id', async (_event, nextDeviceId) => {
    return persistLocalDeviceId(nextDeviceId, getUserId());
  });

  ipcMain.handle('signal:allocate-device-id', async (_event, excludedDeviceIds = []) => {
    const excluded = new Set(
      Array.isArray(excludedDeviceIds)
        ? excludedDeviceIds.map((value) => normalizeDeviceId(value)).filter(Boolean)
        : []
    );

    let nextDeviceId = createRandomDeviceId();
    while (excluded.has(nextDeviceId)) {
      nextDeviceId = createRandomDeviceId();
    }

    return persistLocalDeviceId(nextDeviceId, getUserId());
  });
}

module.exports = {
  registerSignalBridgeLifecycleHandlers,
};
