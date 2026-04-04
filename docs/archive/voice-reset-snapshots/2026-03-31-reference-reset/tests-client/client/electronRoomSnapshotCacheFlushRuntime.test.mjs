import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createRoomSnapshotCacheFlushRuntime,
} = require('../../../client/electron/roomSnapshotCacheFlushRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-room-snapshot-flush-'));
}

test('room snapshot flush runtime flushes dirty states and clears scheduled timers', () => {
  const userDataDir = createTmpUserDataDir();
  const filePath = path.join(userDataDir, 'room-snapshot-cache-user-a.json');
  const cleared = [];
  const timer = { id: 'timer-a' };
  const states = new Map([
    ['user-a', {
      userId: 'user-a',
      filePath,
      entries: {
        roomA: {
          cachedAt: 100,
          hasMore: false,
          messages: [{ id: 'a', attachments: [], _decryptedAttachments: [] }],
        },
      },
      dirty: true,
      flushTimer: timer,
    }],
  ]);

  const {
    flushAllRoomSnapshotStates,
    flushRoomSnapshotState,
  } = createRoomSnapshotCacheFlushRuntime({
    fs,
    logger: console,
    clearTimeoutFn(value) {
      cleared.push(value);
    },
    roomSnapshotStates: states,
    pruneEntries(entries) {
      return entries;
    },
  });

  flushRoomSnapshotState('user-a');
  assert.deepEqual(cleared, [timer]);
  assert.equal(states.get('user-a').dirty, false);
  assert.equal(states.get('user-a').flushTimer, null);
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), {
    roomA: {
      cachedAt: 100,
      hasMore: false,
      messages: [{ id: 'a', attachments: [], _decryptedAttachments: [] }],
    },
  });

  states.get('user-a').dirty = true;
  flushAllRoomSnapshotStates();
  assert.equal(states.get('user-a').dirty, false);
});
