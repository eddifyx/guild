import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  MESSAGE_CACHE_TTL_MS,
  getMessageCacheFilePath,
} = require('../../../client/electron/persistedMessageCachePersistenceRuntime.js');
const {
  createPersistedMessageCacheLoadRuntime,
} = require('../../../client/electron/persistedMessageCacheLoadRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-persisted-cache-load-'));
}

test('persisted message cache load runtime reads, prunes, and caches canonical state', () => {
  const now = 1_700_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const states = new Map();
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

  const { loadMessageCacheState } = createPersistedMessageCacheLoadRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    messageCacheStates: states,
    pruneEntries(entries) {
      const next = {};
      for (const [key, value] of Object.entries(entries || {})) {
        if (now - (value.cachedAt || 0) <= MESSAGE_CACHE_TTL_MS) {
          next[key] = value;
        }
      }
      return next;
    },
  });

  const state = loadMessageCacheState('user-2');
  assert.equal(loadMessageCacheState('user-2'), state);
  assert.deepEqual(state.entries, {
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
  });
  assert.equal(state.dirty, true);
  assert.equal(states.get('user-2'), state);
});
