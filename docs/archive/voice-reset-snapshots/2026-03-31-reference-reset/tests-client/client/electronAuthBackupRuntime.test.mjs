import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  AUTH_BACKUP_FILE_NAME,
  createAuthBackupRuntime,
  getAuthBackupFilePath,
  isProtectedStorageAvailable,
  normalizeAuthBackup,
} = require('../../../client/electron/authBackupRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-auth-backup-'));
}

function createSafeStorage({ available = true } = {}) {
  return {
    isEncryptionAvailable() {
      return available;
    },
    encryptString(value) {
      return Buffer.from(`enc:${value}`, 'utf8');
    },
    decryptString(buffer) {
      const value = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
      return value.startsWith('enc:') ? value.slice(4) : value;
    },
  };
}

test('electron auth backup runtime normalizes and persists encrypted auth data', () => {
  const userDataDir = createTmpUserDataDir();
  const warnings = [];
  const runtime = createAuthBackupRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage(),
    logger: { warn: (...args) => warnings.push(args) },
  });

  const authData = {
    userId: 'user-1',
    username: 'alice',
    token: 'token-1',
    avatarColor: 'blue',
    npub: 'npub1alice',
    profilePicture: '/avatar.png',
    ignored: 'field',
  };

  assert.equal(runtime.writeAuthBackup(authData), true);
  const persistedPath = path.join(userDataDir, AUTH_BACKUP_FILE_NAME);
  const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf8'));
  assert.equal(persisted.encrypted, true);
  assert.equal(typeof persisted.payload, 'string');
  assert.deepEqual(runtime.readAuthBackup(), normalizeAuthBackup(authData));
  assert.deepEqual(warnings, []);
});

test('electron auth backup runtime upgrades legacy payloads and clears unreadable rewrites', () => {
  const userDataDir = createTmpUserDataDir();
  const filePath = path.join(userDataDir, AUTH_BACKUP_FILE_NAME);
  const runtime = createAuthBackupRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage(),
    logger: console,
  });

  fs.writeFileSync(filePath, JSON.stringify({
    userId: 'user-2',
    username: 'bob',
    token: 'token-2',
  }));

  assert.deepEqual(runtime.readAuthBackup(), {
    userId: 'user-2',
    username: 'bob',
    avatarColor: null,
    npub: null,
    profilePicture: null,
    token: 'token-2',
  });
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).encrypted, true);

  fs.writeFileSync(filePath, JSON.stringify({
    userId: 'user-3',
    username: 'carol',
    token: 'token-3',
  }));

  const unavailableRuntime = createAuthBackupRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage({ available: false }),
    logger: console,
  });

  assert.deepEqual(unavailableRuntime.readAuthBackup(), {
    userId: 'user-3',
    username: 'carol',
    avatarColor: null,
    npub: null,
    profilePicture: null,
    token: 'token-3',
  });
  assert.equal(fs.existsSync(filePath), false);
});

test('electron auth backup runtime handles encrypted payload availability and shared helpers', () => {
  const userDataDir = createTmpUserDataDir();
  const filePath = getAuthBackupFilePath({
    app: { getPath: () => userDataDir },
    path,
  });
  const safeStorage = createSafeStorage();

  assert.equal(filePath, path.join(userDataDir, AUTH_BACKUP_FILE_NAME));
  assert.equal(isProtectedStorageAvailable({ safeStorage }), true);
  assert.equal(
    isProtectedStorageAvailable({
      safeStorage: { isEncryptionAvailable() { throw new Error('boom'); } },
    }),
    false
  );

  fs.writeFileSync(filePath, JSON.stringify({
    encrypted: true,
    payload: safeStorage.encryptString(JSON.stringify({
      userId: 'user-4',
      username: 'dora',
      token: 'token-4',
    })).toString('base64'),
  }));

  const runtime = createAuthBackupRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage,
    logger: console,
  });
  const unavailableRuntime = createAuthBackupRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage({ available: false }),
    logger: console,
  });

  assert.deepEqual(runtime.readAuthBackup(), {
    userId: 'user-4',
    username: 'dora',
    avatarColor: null,
    npub: null,
    profilePicture: null,
    token: 'token-4',
  });
  assert.equal(unavailableRuntime.readAuthBackup(), null);
  assert.equal(runtime.clearAuthBackup(), true);
  assert.equal(fs.existsSync(filePath), false);
});
