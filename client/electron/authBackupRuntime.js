const AUTH_BACKUP_FILE_NAME = 'auth-session.json';

function normalizeAuthBackup(authData) {
  if (!authData || typeof authData !== 'object') return null;
  if (typeof authData.token !== 'string' || typeof authData.userId !== 'string') return null;

  return {
    userId: authData.userId,
    username: typeof authData.username === 'string' ? authData.username : '',
    avatarColor: typeof authData.avatarColor === 'string' ? authData.avatarColor : null,
    npub: typeof authData.npub === 'string' ? authData.npub : null,
    profilePicture: typeof authData.profilePicture === 'string' ? authData.profilePicture : null,
    token: authData.token,
  };
}

function getAuthBackupFilePath({ app, path, fileName = AUTH_BACKUP_FILE_NAME }) {
  return path.join(app.getPath('userData'), fileName);
}

function isProtectedStorageAvailable({ safeStorage }) {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function createAuthBackupRuntime({
  app,
  fs,
  path,
  safeStorage,
  logger = console,
  fileName = AUTH_BACKUP_FILE_NAME,
}) {
  function getFilePath() {
    return getAuthBackupFilePath({ app, path, fileName });
  }

  function canUseProtectedStorage() {
    return isProtectedStorageAvailable({ safeStorage });
  }

  function clearAuthBackup() {
    const filePath = getFilePath();
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
      return true;
    } catch (err) {
      logger.warn('[AuthBackup] Failed to clear auth backup:', err?.message || err);
      return false;
    }
  }

  function writeAuthBackup(authData) {
    const normalized = normalizeAuthBackup(authData);
    if (!normalized) return false;
    if (!canUseProtectedStorage()) return false;

    try {
      const filePath = getFilePath();
      const payload = JSON.stringify(normalized);
      const serialized = JSON.stringify({
        encrypted: true,
        payload: safeStorage.encryptString(payload).toString('base64'),
      });

      fs.writeFileSync(filePath, serialized, {
        encoding: 'utf8',
        mode: 0o600,
      });
      try {
        fs.chmodSync(filePath, 0o600);
      } catch {}
      return true;
    } catch (err) {
      logger.warn('[AuthBackup] Failed to persist auth backup:', err?.message || err);
      return false;
    }
  }

  function readAuthBackup() {
    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) return null;

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let authData = null;
      let needsRewrite = false;

      if (!parsed || typeof parsed !== 'object' || !Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
        authData = normalizeAuthBackup(parsed);
        needsRewrite = !!authData;
      } else if (parsed.encrypted) {
        if (typeof parsed.payload !== 'string' || !canUseProtectedStorage()) {
          return null;
        }

        const decrypted = safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'));
        authData = normalizeAuthBackup(JSON.parse(decrypted));
      } else if (typeof parsed.payload === 'string') {
        authData = normalizeAuthBackup(JSON.parse(parsed.payload));
        needsRewrite = !!authData;
      }

      if (authData && needsRewrite) {
        if (!writeAuthBackup(authData)) {
          clearAuthBackup();
        }
      }

      return authData;
    } catch (err) {
      logger.warn('[AuthBackup] Failed to read auth backup:', err?.message || err);
      return null;
    }
  }

  return {
    getAuthBackupFilePath: getFilePath,
    isProtectedStorageAvailable: canUseProtectedStorage,
    readAuthBackup,
    writeAuthBackup,
    clearAuthBackup,
  };
}

module.exports = {
  AUTH_BACKUP_FILE_NAME,
  createAuthBackupRuntime,
  getAuthBackupFilePath,
  isProtectedStorageAvailable,
  normalizeAuthBackup,
};
