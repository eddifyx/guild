function createSignalBridgeStateRuntime({
  app,
  cryptoRef,
  fs,
  path,
  state,
  logger = console,
}) {
  function encryptedMasterKeyPath(uid) {
    return path.join(app.getPath('userData'), `signal-mk-${uid}.enc`);
  }

  function fallbackMasterKeyPath(uid) {
    return path.join(app.getPath('userData'), `signal-mk-${uid}.b64`);
  }

  function protocolStorePaths(uid) {
    const dbPath = path.join(app.getPath('userData'), `signal-protocol-${uid}.db`);
    return [
      dbPath,
      `${dbPath}-wal`,
      `${dbPath}-shm`,
    ];
  }

  function legacyDeviceIdPath() {
    return path.join(app.getPath('userData'), 'signal-device-id.json');
  }

  function deviceIdPath(uid) {
    if (!uid) {
      return legacyDeviceIdPath();
    }

    const digest = cryptoRef.createHash('sha256').update(String(uid)).digest('hex').slice(0, 16);
    return path.join(app.getPath('userData'), `signal-device-id-${digest}.json`);
  }

  function normalizeDeviceId(value) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 127) {
      return null;
    }
    return numeric;
  }

  function createRandomDeviceId() {
    return cryptoRef.randomInt(2, 128);
  }

  function readPersistedDeviceId(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return normalizeDeviceId(parsed?.deviceId);
    } catch {
      return null;
    }
  }

  function archiveLegacyDeviceIdFile() {
    const legacyPath = legacyDeviceIdPath();
    if (!fs.existsSync(legacyPath)) {
      return;
    }

    const backupPath = path.join(
      app.getPath('userData'),
      `signal-device-id.migrated-${Date.now()}.json`
    );

    try {
      fs.renameSync(legacyPath, backupPath);
    } catch (error) {
      logger.warn(
        '[Signal] Failed to archive legacy profile-wide device id file; removing it to avoid cross-account reuse:',
        error
      );
      try {
        fs.unlinkSync(legacyPath);
      } catch (unlinkError) {
        logger.warn('[Signal] Failed to remove legacy profile-wide device id file after migration:', unlinkError);
      }
    }
  }

  function persistLocalDeviceId(deviceId, uid = state.userId) {
    const normalized = normalizeDeviceId(deviceId);
    if (!normalized) {
      throw new Error('Invalid device id');
    }

    const owner = uid ? String(uid) : null;
    const filePath = deviceIdPath(owner);
    state.localDeviceId = normalized;
    state.localDeviceOwner = owner;
    fs.writeFileSync(filePath, JSON.stringify({ deviceId: state.localDeviceId }), {
      encoding: 'utf8',
      mode: 0o600,
    });
    return state.localDeviceId;
  }

  function removeFileIfExists(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    } catch (error) {
      logger.warn('[Signal] Failed to remove persisted local Signal file:', filePath, error);
    }
  }

  function clearPersistedLocalSignalState(uid = state.userId) {
    const owner = uid ? String(uid) : null;

    if (owner) {
      removeFileIfExists(deviceIdPath(owner));
      removeFileIfExists(encryptedMasterKeyPath(owner));
      removeFileIfExists(fallbackMasterKeyPath(owner));
      for (const filePath of protocolStorePaths(owner)) {
        removeFileIfExists(filePath);
      }
    } else {
      removeFileIfExists(legacyDeviceIdPath());
    }

    if (!owner || state.localDeviceOwner === owner) {
      state.localDeviceId = null;
      state.localDeviceOwner = null;
    }
  }

  function hasLegacySignalState(uid) {
    if (!uid) return false;

    const directPaths = [
      encryptedMasterKeyPath(uid),
      fallbackMasterKeyPath(uid),
      ...protocolStorePaths(uid),
    ];
    if (directPaths.some((filePath) => fs.existsSync(filePath))) {
      return true;
    }

    return false;
  }

  function getOrCreateLocalDeviceId(uid = null) {
    const owner = uid ? String(uid) : (state.userId ? String(state.userId) : null);
    if (state.localDeviceId && state.localDeviceOwner === owner) {
      return state.localDeviceId;
    }

    const scopedPath = deviceIdPath(owner);
    const scopedDeviceId = readPersistedDeviceId(scopedPath);
    if (scopedDeviceId) {
      state.localDeviceId = scopedDeviceId;
      state.localDeviceOwner = owner;
      return state.localDeviceId;
    }

    const legacyDeviceId = readPersistedDeviceId(legacyDeviceIdPath());
    if (legacyDeviceId) {
      const migratedDeviceId = persistLocalDeviceId(legacyDeviceId, owner);
      archiveLegacyDeviceIdFile();
      return migratedDeviceId;
    }

    return persistLocalDeviceId(hasLegacySignalState(owner) ? 1 : createRandomDeviceId(), owner);
  }

  function generateMasterKeyBase64() {
    return cryptoRef.randomBytes(32).toString('base64');
  }

  function writeFallbackMasterKey(filePath, mkB64) {
    fs.writeFileSync(filePath, `${mkB64}\n`, { mode: 0o600 });
  }

  function ensureFallbackMasterKey(uid) {
    const fallbackPath = fallbackMasterKeyPath(uid);
    if (fs.existsSync(fallbackPath)) {
      return fs.readFileSync(fallbackPath, 'utf8').trim();
    }

    const mkB64 = generateMasterKeyBase64();
    writeFallbackMasterKey(fallbackPath, mkB64);
    return mkB64;
  }

  function getMasterKey(uid) {
    const encryptedPath = encryptedMasterKeyPath(uid);
    const fallbackPath = fallbackMasterKeyPath(uid);

    if (fs.existsSync(fallbackPath)) {
      return {
        keyBase64: fs.readFileSync(fallbackPath, 'utf8').trim(),
        storage: 'fallback',
        requiresStoreReset: false,
      };
    }

    if (fs.existsSync(encryptedPath)) {
      logger.warn('[Signal] Legacy OS-keychain-backed master key detected. Rotating Signal state to app-local storage.');
      return {
        keyBase64: ensureFallbackMasterKey(uid),
        storage: 'fallback-recovery',
        requiresStoreReset: true,
      };
    }

    const mkB64 = generateMasterKeyBase64();
    writeFallbackMasterKey(fallbackPath, mkB64);
    return {
      keyBase64: mkB64,
      storage: 'fallback',
      requiresStoreReset: false,
    };
  }

  function resetSignalProtocolStore(uid) {
    for (const filePath of protocolStorePaths(uid)) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        logger.warn('[Signal] Failed to remove stale protocol store file:', filePath, error);
      }
    }
  }

  function shouldResetProtocolStore(error) {
    const details = `${error?.message || ''}\n${error?.stack || ''}`;
    return /authenticate data|bad decrypt|unable to authenticate|unsupported state/i.test(details);
  }

  return {
    archiveLegacyDeviceIdFile,
    clearPersistedLocalSignalState,
    createRandomDeviceId,
    deviceIdPath,
    encryptedMasterKeyPath,
    fallbackMasterKeyPath,
    generateMasterKeyBase64,
    getMasterKey,
    getOrCreateLocalDeviceId,
    hasLegacySignalState,
    legacyDeviceIdPath,
    normalizeDeviceId,
    persistLocalDeviceId,
    protocolStorePaths,
    readPersistedDeviceId,
    resetSignalProtocolStore,
    shouldResetProtocolStore,
  };
}

module.exports = {
  createSignalBridgeStateRuntime,
};
