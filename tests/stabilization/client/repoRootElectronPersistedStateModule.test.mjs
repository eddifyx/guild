import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('repo root electron main delegates auth backup, message cache, and room snapshots to the persisted state runtime', async () => {
  const mainSource = await readFile(
    new URL('../../../main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/persistedStateRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/client\/electron\/persistedStateRuntime'\)/);
  assert.match(mainSource, /createPersistedStateRuntime\(/);
  assert.match(mainSource, /additionalBeforeQuitHandlers: \[/);
  assert.match(mainSource, /flushAllMessageCacheStates,/);
  assert.match(mainSource, /flushAllRoomSnapshotStates,/);
  assert.match(mainSource, /getMessageCacheEntry,/);
  assert.match(mainSource, /getManyMessageCacheEntries,/);
  assert.match(mainSource, /setMessageCacheEntry,/);
  assert.match(mainSource, /getRoomSnapshotEntry,/);
  assert.match(mainSource, /setRoomSnapshotEntry,/);
  assert.match(mainSource, /readAuthBackup,/);
  assert.match(mainSource, /writeAuthBackup,/);
  assert.match(mainSource, /clearAuthBackup,/);
  assert.doesNotMatch(mainSource, /function normalizeAuthBackup\(/);
  assert.doesNotMatch(mainSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(mainSource, /function pruneRoomSnapshotEntries\(/);
  assert.match(runtimeSource, /function createPersistedStateRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/persistedAuthBackupRuntime'\)/);
  assert.match(runtimeSource, /createPersistedAuthBackupRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/persistedMessageCacheRuntime'\)/);
  assert.match(runtimeSource, /createPersistedMessageCacheRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/roomSnapshotCacheRuntime'\)/);
  assert.match(runtimeSource, /createRoomSnapshotCacheRuntime\(/);
  assert.doesNotMatch(runtimeSource, /function pruneMessageCacheEntries\(/);
  assert.doesNotMatch(runtimeSource, /function pruneRoomSnapshotEntries\(/);
});
