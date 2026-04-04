import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createMessageCachePersistenceFlushRuntime,
} = require('../../../client/electron/messageCachePersistenceFlushRuntime.js');

test('electron message cache persistence flush runtime writes serialized state and clears pending timers', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-message-cache-flush-'));
  const filePath = path.join(tempDir, 'cache.json');
  const cleared = [];
  const timer = { id: 'timer-1' };
  const messageCacheStates = new Map([
    ['user-1', {
      userId: 'user-1',
      filePath,
      entries: {
        one: {
          ciphertextHash: 'hash-1',
          body: 'body-1',
          attachments: [],
          cachedAt: 123,
        },
      },
      dirty: true,
      flushTimer: timer,
    }],
  ]);

  const flushRuntime = createMessageCachePersistenceFlushRuntime({
    fs,
    clearTimeoutFn(value) {
      cleared.push(value);
    },
    messageCacheStates,
    pruneEntries(entries) {
      return entries;
    },
    serialize(entries) {
      return JSON.stringify(entries);
    },
  });

  flushRuntime.flushMessageCacheState('user-1');

  assert.deepEqual(cleared, [timer]);
  assert.equal(messageCacheStates.get('user-1').dirty, false);
  assert.equal(messageCacheStates.get('user-1').flushTimer, null);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(filePath, 'utf8')),
    messageCacheStates.get('user-1').entries
  );
});
