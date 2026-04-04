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
  encodeMessageCacheSegment,
  getMessageCacheDir,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
} = require('../../../client/electron/messageCacheModel.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-message-cache-model-'));
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

test('electron message cache model normalizes paths, entries, pruning, and encrypted payloads canonically', () => {
  const now = 5_000;
  const userDataDir = createTmpUserDataDir();
  const safeStorage = createSafeStorage();
  const encoded = encodeMessageCacheSegment('user-1');
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
  }, { safeStorage });
  const restored = deserializeMessageCache(serialized, { safeStorage });
  assert.equal(typeof serialized, 'string');
  assert.deepEqual(restored, {
    entries: {
      keep: {
        ciphertextHash: 'hash-keep',
        body: 'body-keep',
        attachments: [],
        cachedAt: now,
      },
    },
    needsRewrite: false,
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
