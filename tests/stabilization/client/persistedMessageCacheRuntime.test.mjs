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
  createPersistedMessageCacheRuntime,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
} = require('../../../client/electron/persistedMessageCacheRuntime.js');
const {
  getMessageCacheFilePath: getMessageCacheFilePathFromModel,
  normalizeMessageCacheEntry: normalizeMessageCacheEntryFromModel,
  pruneMessageCacheEntries: pruneMessageCacheEntriesFromModel,
} = require('../../../client/electron/persistedMessageCacheModel.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-message-cache-'));
}

test('persisted message cache runtime persists plain entries and prunes stale legacy records', () => {
  const now = 1_700_000_000_000;
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
  }));

  const runtime = createPersistedMessageCacheRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
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

  assert.equal(
    runtime.setMessageCacheEntry('user-2', 'msg-1', {
      ciphertextHash: 'hash-1',
      body: 'body-1',
      attachments: [{ id: 'file-1' }],
    }),
    true
  );

  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(persisted.encrypted, false);
  assert.deepEqual(runtime.getMessageCacheEntry('user-2', 'msg-1'), {
    ciphertextHash: 'hash-1',
    body: 'body-1',
    attachments: [{ id: 'file-1' }],
    cachedAt: now,
  });
  assert.deepEqual(runtime.getManyMessageCacheEntries('user-2', ['keep', 'missing', 'msg-1']), [
    {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
    null,
    {
      ciphertextHash: 'hash-1',
      body: 'body-1',
      attachments: [{ id: 'file-1' }],
      cachedAt: now,
    },
  ]);
  assert.equal(runtime.deleteMessageCacheEntry('user-2', 'msg-1'), true);
  assert.equal(runtime.getMessageCacheEntry('user-2', 'msg-1'), null);
});

test('persisted message cache runtime re-exports shared model helpers', () => {
  assert.equal(getMessageCacheFilePath, getMessageCacheFilePathFromModel);
  assert.equal(normalizeMessageCacheEntry, normalizeMessageCacheEntryFromModel);
  assert.equal(pruneMessageCacheEntries, pruneMessageCacheEntriesFromModel);
  assert.equal(MESSAGE_CACHE_LIMIT, 400);
  assert.equal(MESSAGE_CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});
