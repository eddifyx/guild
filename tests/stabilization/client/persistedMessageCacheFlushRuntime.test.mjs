import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createPersistedMessageCacheFlushRuntime,
} = require('../../../client/electron/persistedMessageCacheFlushRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-persisted-cache-flush-'));
}

test('persisted message cache flush runtime flushes dirty states and clears scheduled timers', () => {
  const userDataDir = createTmpUserDataDir();
  const filePath = path.join(userDataDir, 'message-cache-user-a.json');
  const cleared = [];
  const timer = { id: 'timer-a' };
  const states = new Map([
    ['user-a', {
      userId: 'user-a',
      filePath,
      entries: {
        keep: {
          ciphertextHash: 'hash-a',
          body: 'body-a',
          attachments: [],
          cachedAt: 100,
        },
      },
      dirty: true,
      flushTimer: timer,
    }],
  ]);

  const {
    flushAllMessageCacheStates,
    flushMessageCacheState,
  } = createPersistedMessageCacheFlushRuntime({
    fs,
    logger: console,
    clearTimeoutFn(value) {
      cleared.push(value);
    },
    messageCacheStates: states,
    pruneEntries(entries) {
      return entries;
    },
  });

  flushMessageCacheState('user-a');
  assert.deepEqual(cleared, [timer]);
  assert.equal(states.get('user-a').dirty, false);
  assert.equal(states.get('user-a').flushTimer, null);
  assert.deepEqual(JSON.parse(JSON.parse(fs.readFileSync(filePath, 'utf8')).payload), {
    keep: {
      ciphertextHash: 'hash-a',
      body: 'body-a',
      attachments: [],
      cachedAt: 100,
    },
  });

  states.get('user-a').dirty = true;
  flushAllMessageCacheStates();
  assert.equal(states.get('user-a').dirty, false);
});
