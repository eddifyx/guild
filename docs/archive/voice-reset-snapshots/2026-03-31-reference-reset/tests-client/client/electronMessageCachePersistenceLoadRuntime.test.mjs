import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createMessageCachePersistenceLoadRuntime,
} = require('../../../client/electron/messageCachePersistenceLoadRuntime.js');
const {
  MESSAGE_CACHE_TTL_MS,
  deserializeMessageCache,
  getMessageCacheFilePath,
  pruneMessageCacheEntries,
} = require('../../../client/electron/messageCacheModel.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-message-cache-load-'));
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

test('electron message cache persistence load runtime upgrades legacy cache files and prunes invalid or stale entries', () => {
  const now = 1_700_000_100_000;
  const safeStorage = createSafeStorage();
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

  const loadRuntime = createMessageCachePersistenceLoadRuntime({
    fs,
    logger: console,
    deserialize(raw) {
      return deserializeMessageCache(raw, { safeStorage });
    },
    getFilePath(userId) {
      return getMessageCacheFilePath({
        app: { getPath: () => userDataDir },
        fs,
        path,
        userId,
      });
    },
    pruneEntries(entries) {
      return pruneMessageCacheEntries(entries, {
        now,
      });
    },
  });

  const state = loadRuntime.loadMessageCacheState('user-2');
  assert.deepEqual(state.entries, {
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
  });
  assert.equal(state.dirty, true);
  assert.equal(state.flushTimer, null);
});
