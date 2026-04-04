import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  createMessageCacheRuntime,
  getMessageCacheFilePath,
  pruneMessageCacheEntries,
} = require('../../../client/electron/messageCacheRuntime.js');
const {
  getMessageCacheFilePath: getMessageCacheFilePathFromModel,
  pruneMessageCacheEntries: pruneMessageCacheEntriesFromModel,
} = require('../../../client/electron/messageCacheModel.js');
const {
  createMessageCachePersistenceRuntime,
} = require('../../../client/electron/messageCachePersistenceRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-message-cache-'));
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

test('electron message cache runtime persists encrypted cache entries and reloads them canonically', () => {
  const now = 1_700_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const runtime = createMessageCacheRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage(),
    logger: console,
    nowFn: () => now,
  });

  assert.equal(
    runtime.setMessageCacheEntry('user-1', 'msg-1', {
      ciphertextHash: 'hash-1',
      body: 'plain-1',
      attachments: [{ id: 'file-1' }],
    }),
    true
  );

  const filePath = getMessageCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-1',
  });
  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(persisted.encrypted, true);
  assert.equal(typeof persisted.payload, 'string');
  assert.deepEqual(runtime.getMessageCacheEntry('user-1', 'msg-1'), {
    ciphertextHash: 'hash-1',
    body: 'plain-1',
    attachments: [{ id: 'file-1' }],
    cachedAt: now,
  });
  assert.deepEqual(runtime.getManyMessageCacheEntries('user-1', ['msg-1', 'msg-2']), {
    'msg-1': {
      ciphertextHash: 'hash-1',
      body: 'plain-1',
      attachments: [{ id: 'file-1' }],
      cachedAt: now,
    },
  });
  assert.equal(runtime.deleteMessageCacheEntry('user-1', 'msg-1'), true);
  assert.equal(runtime.getMessageCacheEntry('user-1', 'msg-1'), null);
});

test('electron message cache runtime expires stale entries on read and delegates persistence helpers to the dedicated runtime', () => {
  const now = 1_700_000_200_000;
  const userDataDir = createTmpUserDataDir();
  const persistenceRuntime = createMessageCachePersistenceRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage(),
    logger: console,
    nowFn: () => now,
  });
  const runtime = createMessageCacheRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    safeStorage: createSafeStorage(),
    logger: console,
    nowFn: () => now,
  });

  assert.equal(typeof persistenceRuntime.loadMessageCacheState, 'function');
  assert.equal(typeof persistenceRuntime.flushMessageCacheState, 'function');
  assert.equal(typeof persistenceRuntime.scheduleMessageCacheFlush, 'function');

  runtime.setMessageCacheEntry('user-2', 'fresh', {
    ciphertextHash: 'hash-fresh',
    body: 'body-fresh',
    attachments: [],
  });
  runtime.loadMessageCacheState('user-2').entries.stale = {
    ciphertextHash: 'hash-stale',
    body: 'body-stale',
    attachments: [],
    cachedAt: now - MESSAGE_CACHE_TTL_MS - 1,
  };

  assert.equal(runtime.getMessageCacheEntry('user-2', 'stale'), null);
  assert.deepEqual(runtime.getManyMessageCacheEntries('user-2', ['fresh', 'stale']), {
    fresh: {
      ciphertextHash: 'hash-fresh',
      body: 'body-fresh',
      attachments: [],
      cachedAt: now,
    },
  });
});

test('electron message cache runtime re-exports shared file-path and pruning helpers', () => {
  assert.equal(getMessageCacheFilePath, getMessageCacheFilePathFromModel);
  assert.equal(pruneMessageCacheEntries, pruneMessageCacheEntriesFromModel);
  assert.equal(MESSAGE_CACHE_LIMIT, 2000);
  assert.equal(MESSAGE_CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});
