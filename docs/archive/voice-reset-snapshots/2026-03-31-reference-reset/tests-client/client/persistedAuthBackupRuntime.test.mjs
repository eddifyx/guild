import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  AUTH_BACKUP_FILE_NAME,
  createPersistedAuthBackupRuntime,
  getAuthBackupFilePath,
  normalizeAuthBackup,
} = require('../../../client/electron/persistedAuthBackupRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-auth-backup-'));
}

test('persisted auth backup runtime normalizes and persists auth backup data canonically', () => {
  const userDataDir = createTmpUserDataDir();
  const runtime = createPersistedAuthBackupRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
  });

  const authData = {
    userId: 'user-1',
    username: 'alice',
    token: 'token-1',
    avatarColor: 'blue',
    npub: 'npub1alice',
    profilePicture: '/avatar.png',
  };

  assert.equal(
    getAuthBackupFilePath({
      app: { getPath: () => userDataDir },
      path,
    }),
    path.join(userDataDir, AUTH_BACKUP_FILE_NAME)
  );
  assert.equal(runtime.writeAuthBackup(authData), true);
  assert.deepEqual(runtime.readAuthBackup(), normalizeAuthBackup(authData));
  assert.equal(runtime.clearAuthBackup(), true);
  assert.equal(fs.existsSync(path.join(userDataDir, AUTH_BACKUP_FILE_NAME)), false);
});
