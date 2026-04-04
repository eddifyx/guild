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
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  createPersistedStateRuntime,
  getMessageCacheFilePath,
  getRoomSnapshotCacheFilePath,
  pruneMessageCacheEntries,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
} = require('../../../client/electron/persistedStateRuntime.js');

function createTmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-persisted-state-'));
}

test('electron persisted state runtime persists plain message cache entries and prunes stale legacy records', () => {
  const now = 1_700_000_000_000;
  const userDataDir = createTmpUserDataDir();
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

  const runtime = createPersistedStateRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

  const state = runtime.loadMessageCacheState('user-2');
  assert.deepEqual(state.entries, {
    keep: {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
  });
  assert.equal(state.dirty, true);

  assert.equal(
    runtime.setMessageCacheEntry('user-2', 'msg-1', {
      ciphertextHash: 'hash-1',
      body: 'body-1',
      attachments: [{ id: 'file-1' }],
    }),
    true
  );
  const persisted = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(persisted.encrypted, false);
  assert.deepEqual(runtime.getMessageCacheEntry('user-2', 'msg-1'), {
    ciphertextHash: 'hash-1',
    body: 'body-1',
    attachments: [{ id: 'file-1' }],
    cachedAt: now,
  });
  assert.deepEqual(runtime.getManyMessageCacheEntries('user-2', ['keep', 'missing', 'msg-1']), [
    {
      ciphertextHash: 'hash-keep',
      body: 'body-keep',
      attachments: [],
      cachedAt: now - 10,
    },
    null,
    {
      ciphertextHash: 'hash-1',
      body: 'body-1',
      attachments: [{ id: 'file-1' }],
      cachedAt: now,
    },
  ]);
  assert.equal(runtime.deleteMessageCacheEntry('user-2', 'msg-1'), true);
  assert.equal(runtime.getMessageCacheEntry('user-2', 'msg-1'), null);
});

test('electron persisted state runtime sanitizes room snapshots and prunes stale or oversized entries', () => {
  const now = 1_800_000_000_000;
  const userDataDir = createTmpUserDataDir();
  const runtime = createPersistedStateRuntime({
    app: { getPath: () => userDataDir },
    fs,
    path,
    logger: console,
    nowFn: () => now,
  });

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

  const snapshotPath = getRoomSnapshotCacheFilePath({
    app: { getPath: () => userDataDir },
    fs,
    path,
    userId: 'user-3',
  });
  assert.equal(fs.existsSync(snapshotPath), true);
});

test('electron persisted state runtime helper pruning keeps cache and room snapshot contracts bounded', () => {
  const now = 5_000;
  const messageEntries = {};
  for (let index = 0; index < MESSAGE_CACHE_LIMIT + 2; index += 1) {
    messageEntries[`msg-${index}`] = {
      ciphertextHash: `hash-${index}`,
      body: `body-${index}`,
      cachedAt: now - index,
    };
  }
  messageEntries.expired = {
    ciphertextHash: 'hash-expired',
    body: 'body-expired',
    cachedAt: now - MESSAGE_CACHE_TTL_MS - 1,
  };

  const prunedMessages = pruneMessageCacheEntries(messageEntries, { now });
  assert.equal(Object.keys(prunedMessages).length, MESSAGE_CACHE_LIMIT);
  assert.equal('expired' in prunedMessages, false);

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
