import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  ROOM_SNAPSHOT_TTL_MS,
  createRoomSnapshotCachePersistenceRuntime,
  getRoomSnapshotCacheFilePath,
} = require('../../../client/electron/roomSnapshotCachePersistenceRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-room-snapshot-persist-'));
}

test('electron room snapshot cache persistence runtime loads, prunes, and flushes canonical state', () => {
  const now = 1_800_000_000_000;
  const userDataDir = createTmpUserDataDir();
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
      messages: [{ id: 'keep' }],
    },
    stale: {
      cachedAt: now - ROOM_SNAPSHOT_TTL_MS - 1,
      hasMore: false,
      messages: [{ id: 'stale' }],
    },
  }), 'utf8');

  const runtime = createRoomSnapshotCachePersistenceRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

  const state = runtime.loadRoomSnapshotState('user-2');
  assert.deepEqual(state.entries, {
    keep: {
      cachedAt: now - 10,
      hasMore: false,
      messages: [{ id: 'keep', attachments: [], _decryptedAttachments: [] }],
    },
  });
  assert.equal(state.dirty, true);

  runtime.flushRoomSnapshotState('user-2');

  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.deepEqual(persisted, state.entries);
  assert.equal(state.dirty, false);
});

test('electron room snapshot cache persistence runtime flushes all loaded states', () => {
  const now = 1_800_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const runtime = createRoomSnapshotCachePersistenceRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

  const stateA = runtime.loadRoomSnapshotState('user-a');
  const stateB = runtime.loadRoomSnapshotState('user-b');
  stateA.entries.roomA = {
    cachedAt: now,
    hasMore: false,
    messages: [{ id: 'a' }],
  };
  stateB.entries.roomB = {
    cachedAt: now,
    hasMore: true,
    messages: [{ id: 'b' }],
  };
  stateA.dirty = true;
  stateB.dirty = true;

  runtime.flushAllRoomSnapshotStates();

  assert.equal(stateA.dirty, false);
  assert.equal(stateB.dirty, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateA.filePath, 'utf8')), {
    roomA: {
      cachedAt: now,
      hasMore: false,
      messages: [{ id: 'a', attachments: [], _decryptedAttachments: [] }],
    },
  });
  assert.deepEqual(JSON.parse(fs.readFileSync(stateB.filePath, 'utf8')), {
    roomB: {
      cachedAt: now,
      hasMore: true,
      messages: [{ id: 'b', attachments: [], _decryptedAttachments: [] }],
    },
  });
});
