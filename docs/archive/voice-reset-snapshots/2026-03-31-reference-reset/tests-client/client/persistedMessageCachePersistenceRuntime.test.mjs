import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  MESSAGE_CACHE_TTL_MS,
  createPersistedMessageCachePersistenceRuntime,
  getMessageCacheFilePath,
} = require('../../../client/electron/persistedMessageCachePersistenceRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-persisted-cache-'));
}

test('persisted message cache persistence runtime loads, prunes, and flushes canonical state', () => {
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

  const runtime = createPersistedMessageCachePersistenceRuntime({
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

  runtime.flushMessageCacheState('user-2');

  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(JSON.parse(persisted.payload), {
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
  });
  assert.equal(state.dirty, false);
});

test('persisted message cache persistence runtime flushes all loaded states', () => {
  const now = 1_700_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const runtime = createPersistedMessageCachePersistenceRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

  const stateA = runtime.loadMessageCacheState('user-a');
  const stateB = runtime.loadMessageCacheState('user-b');
  stateA.entries.first = {
    ciphertextHash: 'hash-a',
    body: 'body-a',
    attachments: [],
    cachedAt: now,
  };
  stateB.entries.second = {
    ciphertextHash: 'hash-b',
    body: 'body-b',
    attachments: [],
    cachedAt: now,
  };
  stateA.dirty = true;
  stateB.dirty = true;

  runtime.flushAllMessageCacheStates();

  assert.equal(stateA.dirty, false);
  assert.equal(stateB.dirty, false);
  assert.deepEqual(
    JSON.parse(JSON.parse(fs.readFileSync(stateA.filePath, 'utf8')).payload),
    stateA.entries
  );
  assert.deepEqual(
    JSON.parse(JSON.parse(fs.readFileSync(stateB.filePath, 'utf8')).payload),
    stateB.entries
  );
});
