import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createRoomSnapshotCacheRuntime,
} = require('../../../client/electron/roomSnapshotCacheRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-room-snapshot-'));
}

test('electron room snapshot cache runtime persists canonical room entries', () => {
  const now = 1_800_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const runtime = createRoomSnapshotCacheRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

  assert.equal(
    runtime.setRoomSnapshotEntry('user-3', 'room-1', {
      cachedAt: now,
      hasMore: true,
      messages: [
        { id: 'optimistic', _optimistic: true },
        { id: 'kept', attachments: [{ id: 'a1', _previewUrl: 'blob:preview' }] },
      ],
    }),
    true
  );
  assert.deepEqual(runtime.getRoomSnapshotEntry('user-3', 'room-1'), {
    cachedAt: now,
    hasMore: true,
    messages: [{ id: 'kept', attachments: [{ id: 'a1' }], _decryptedAttachments: [] }],
  });
  assert.equal(runtime.loadRoomSnapshotState('user-3').filePath.endsWith('.json'), true);
});

test('electron room snapshot cache runtime prunes stale persisted entries when loading state', () => {
  const now = 5_000;
  const userDataDir = createTmpUserDataDir();
  const encodedUserId = Buffer.from('user-9').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const snapshotDir = path.join(userDataDir, 'room-snapshots');
  const snapshotPath = path.join(snapshotDir, `${encodedUserId}.json`);

  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(snapshotPath, JSON.stringify({
    stale: {
      cachedAt: now - (24 * 60 * 60 * 1000) - 1,
      hasMore: false,
      messages: [{ id: 'stale' }],
    },
    keep: {
      cachedAt: now - 1,
      hasMore: false,
      messages: [{ id: 'keep' }],
    },
  }), 'utf8');

  const runtime = createRoomSnapshotCacheRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

  const state = runtime.loadRoomSnapshotState('user-9');
  assert.deepEqual(Object.keys(state.entries), ['keep']);
  assert.equal(state.dirty, true);
});
