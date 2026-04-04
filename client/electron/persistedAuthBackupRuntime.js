const AUTH_BACKUP_FILE_NAME = 'auth-session.json';

function getAuthBackupFilePath({
  app,
  path,
  fileName = AUTH_BACKUP_FILE_NAME,
}) {
  return path.join(app.getPath('userData'), fileName);
}

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

function createPersistedAuthBackupRuntime({
  app,
  fs,
  path,
  logger = console,
  fileName = AUTH_BACKUP_FILE_NAME,
}) {
  function readAuthBackup() {
    const filePath = getAuthBackupFilePath({ app, path, fileName });
    if (!fs.existsSync(filePath)) return null;

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return normalizeAuthBackup(parsed);
    } catch (err) {
      logger.warn('[AuthBackup] Failed to read auth backup:', err?.message || err);
      return null;
    }
  }

  function writeAuthBackup(authData) {
    const normalized = normalizeAuthBackup(authData);
    if (!normalized) return false;

    try {
      fs.writeFileSync(
        getAuthBackupFilePath({ app, path, fileName }),
        JSON.stringify(normalized),
        'utf8'
      );
      return true;
    } catch (err) {
      logger.warn('[AuthBackup] Failed to persist auth backup:', err?.message || err);
      return false;
    }
  }

  function clearAuthBackup() {
    const filePath = getAuthBackupFilePath({ app, path, fileName });
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

  return {
    clearAuthBackup,
    getAuthBackupFilePath: () => getAuthBackupFilePath({ app, path, fileName }),
    readAuthBackup,
    writeAuthBackup,
  };
}

module.exports = {
  AUTH_BACKUP_FILE_NAME,
  createPersistedAuthBackupRuntime,
  getAuthBackupFilePath,
  normalizeAuthBackup,
};
