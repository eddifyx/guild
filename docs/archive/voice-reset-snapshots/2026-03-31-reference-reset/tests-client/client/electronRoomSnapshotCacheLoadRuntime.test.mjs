import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  ROOM_SNAPSHOT_TTL_MS,
  getRoomSnapshotCacheFilePath,
} = require('../../../client/electron/roomSnapshotCachePersistenceRuntime.js');
const {
  createRoomSnapshotCacheLoadRuntime,
} = require('../../../client/electron/roomSnapshotCacheLoadRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-room-snapshot-load-'));
}

test('room snapshot load runtime reads, prunes, and caches canonical state', () => {
  const now = 1_800_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const states = new Map();
  const filePath = getRoomSnapshotCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-2',
  });

  fs.writeFileSync(filePath, JSON.stringify({
    keep: {
      cachedAt: now - 10,
      hasMore: false,
      messages: [{ id: 'keep', attachments: [], _decryptedAttachments: [] }],
    },
    stale: {
      cachedAt: now - ROOM_SNAPSHOT_TTL_MS - 1,
      hasMore: false,
      messages: [{ id: 'stale', attachments: [], _decryptedAttachments: [] }],
    },
  }), 'utf8');

  const { loadRoomSnapshotState } = createRoomSnapshotCacheLoadRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    roomSnapshotStates: states,
    pruneEntries(entries) {
      const next = {};
      for (const [key, value] of Object.entries(entries || {})) {
        if (now - (value.cachedAt || 0) <= ROOM_SNAPSHOT_TTL_MS) {
          next[key] = value;
        }
      }
      return next;
    },
  });

  const state = loadRoomSnapshotState('user-2');
  assert.equal(loadRoomSnapshotState('user-2'), state);
  assert.deepEqual(state.entries, {
    keep: {
      cachedAt: now - 10,
      hasMore: false,
      messages: [{ id: 'keep', attachments: [], _decryptedAttachments: [] }],
    },
  });
  assert.equal(state.dirty, true);
  assert.equal(states.get('user-2'), state);
});
