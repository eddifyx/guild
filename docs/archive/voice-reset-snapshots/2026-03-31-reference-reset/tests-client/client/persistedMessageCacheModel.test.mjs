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
  deserializeMessageCache,
  encodePersistenceSegment,
  getMessageCacheDir,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('../../../client/electron/persistedMessageCacheModel.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-persisted-message-cache-model-'));
}

test('persisted message cache model normalizes paths, entries, pruning, and plain payloads canonically', () => {
  const now = 5_000;
  const userDataDir = createTmpUserDataDir();
  const encoded = encodePersistenceSegment('user-1');
  const dir = getMessageCacheDir({
    app: { getPath: () => userDataDir },
    fs,
    path,
  });
  const filePath = getMessageCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-1',
  });

  assert.equal(dir, path.join(userDataDir, 'message-cache'));
  assert.equal(filePath, path.join(dir, `${encoded}.json`));
  assert.deepEqual(
    normalizeMessageCacheEntry({
      ciphertextHash: 'hash-1',
      body: 'body-1',
      attachments: [{ id: 'file-1' }],
    }, { now }),
    {
      ciphertextHash: 'hash-1',
      body: 'body-1',
      attachments: [{ id: 'file-1' }],
      cachedAt: now,
    }
  );

  const serialized = serializeMessageCache({
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now,
    },
  });
  assert.deepEqual(deserializeMessageCache(serialized), {
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now,
    },
  });

  const entries = {};
  for (let index = 0; index < MESSAGE_CACHE_LIMIT + 2; index += 1) {
    entries[`msg-${index}`] = {
      ciphertextHash: `hash-${index}`,
      body: `body-${index}`,
      cachedAt: now - index,
    };
  }
  entries.expired = {
    ciphertextHash: 'hash-expired',
    body: 'body-expired',
    cachedAt: now - MESSAGE_CACHE_TTL_MS - 1,
  };
  const pruned = pruneMessageCacheEntries(entries, { now });
  assert.equal(Object.keys(pruned).length, MESSAGE_CACHE_LIMIT);
  assert.equal('expired' in pruned, false);
});
