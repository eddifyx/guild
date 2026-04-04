import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  MESSAGE_CACHE_TTL_MS,
  createMessageCachePersistenceStateRuntime,
  getMessageCacheFilePath,
} = require('../../../client/electron/messageCachePersistenceStateRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-message-cache-state-'));
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

test('electron message cache persistence state runtime upgrades legacy cache files and prunes invalid or stale entries', () => {
  const now = 1_700_000_100_000;
  const userDataDir = createTmpUserDataDir();
  const filePath = getMessageCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-2',
  });

  fs.writeFileSync(filePath, JSON.stringify({
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
    stale: {
      ciphertextHash: 'hash-stale',
      body: 'body-stale',
      attachments: [],
      cachedAt: now - MESSAGE_CACHE_TTL_MS - 1,
    },
    invalid: {
      ciphertextHash: 'hash-invalid',
      attachments: [],
      cachedAt: now - 10,
    },
  }));

  const runtime = createMessageCachePersistenceStateRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage(),
    logger: console,
    nowFn: () => now,
  });

  const state = runtime.loadMessageCacheState('user-2');
  assert.deepEqual(state.entries, {
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
  });
  assert.equal(state.dirty, true);

  runtime.flushAllMessageCacheStates();

  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(persisted.encrypted, true);
});

test('electron message cache persistence state runtime removes persisted files when protected storage is unavailable and schedules flush once', () => {
  const now = 1_700_000_200_000;
  const userDataDir = createTmpUserDataDir();
  const filePath = getMessageCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-3',
  });
  const scheduled = [];
  const cleared = [];
  const runtime = createMessageCachePersistenceStateRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage({ available: false }),
    logger: console,
    nowFn: () => now,
    setTimeoutFn(callback, delay) {
      const timer = {
        callback,
        delay,
        unrefCalled: false,
        unref() {
          this.unrefCalled = true;
        },
      };
      scheduled.push(timer);
      return timer;
    },
    clearTimeoutFn(timer) {
      cleared.push(timer);
    },
  });

  fs.writeFileSync(filePath, 'legacy');
  runtime.loadMessageCacheState('user-3').dirty = true;
  runtime.scheduleMessageCacheFlush('user-3');
  runtime.scheduleMessageCacheFlush('user-3');

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 100);
  assert.equal(scheduled[0].unrefCalled, true);

  scheduled[0].callback();

  assert.equal(fs.existsSync(filePath), false);
  assert.equal(cleared.length, 1);
});
