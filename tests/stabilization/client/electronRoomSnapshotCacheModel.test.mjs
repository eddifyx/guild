import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
} = require('../../../client/electron/roomSnapshotCacheModel.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-room-snapshot-model-'));
}

test('electron room snapshot cache model sanitizes messages and resolves canonical persistence paths', () => {
  const userDataDir = createTmpUserDataDir();

  assert.deepEqual(
    sanitizeRoomSnapshotMessage({
      id: 'msg-1',
      attachments: [{ id: 'a1', _previewUrl: 'blob:preview', name: 'file.png' }],
      _decryptedAttachments: [{ id: 'a2', _previewUrl: 'blob:preview-2', name: 'file-2.png' }],
    }),
    {
      id: 'msg-1',
      attachments: [{ id: 'a1', name: 'file.png' }],
      _decryptedAttachments: [{ id: 'a2', name: 'file-2.png' }],
    }
  );

  const snapshotPath = getRoomSnapshotCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-3',
  });
  assert.match(snapshotPath, /room-snapshots\/[A-Za-z0-9_-]+\.json$/);
  assert.equal(fs.existsSync(path.dirname(snapshotPath)), true);
});

test('electron room snapshot cache model prunes stale and oversized room caches canonically', () => {
  const now = 5_000;
  const roomEntries = {};
  for (let index = 0; index < ROOM_SNAPSHOT_LIMIT + 2; index += 1) {
    roomEntries[`room-${index}`] = {
      cachedAt: now - index,
      hasMore: false,
      messages: [{ id: `msg-${index}` }],
    };
  }
  roomEntries.expired = {
    cachedAt: now - ROOM_SNAPSHOT_TTL_MS - 1,
    hasMore: false,
    messages: [{ id: 'expired' }],
  };

  const prunedRooms = pruneRoomSnapshotEntries(roomEntries, { now });
  assert.equal(Object.keys(prunedRooms).length, ROOM_SNAPSHOT_LIMIT);
  assert.equal('expired' in prunedRooms, false);
});
