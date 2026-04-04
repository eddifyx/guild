import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted state runtime delegates room snapshot ownership to the dedicated room snapshot cache runtime', async () => {
  const persistedStateSource = await readFile(
    new URL('../../../client/electron/persistedStateRuntime.js', import.meta.url),
    'utf8'
  );
  const snapshotRuntimeSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheRuntime.js', import.meta.url),
    'utf8'
  );
  const snapshotPersistenceSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const snapshotLoadSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheLoadRuntime.js', import.meta.url),
    'utf8'
  );
  const snapshotFlushSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheFlushRuntime.js', import.meta.url),
    'utf8'
  );
  const snapshotModelSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheModel.js', import.meta.url),
    'utf8'
  );

  assert.match(persistedStateSource, /require\('\.\/roomSnapshotCacheRuntime'\)/);
  assert.match(persistedStateSource, /createRoomSnapshotCacheRuntime\(/);
  assert.doesNotMatch(persistedStateSource, /function sanitizeRoomSnapshotMessage\(/);
  assert.doesNotMatch(persistedStateSource, /function pruneRoomSnapshotEntries\(/);
  assert.doesNotMatch(persistedStateSource, /function loadRoomSnapshotState\(/);
  assert.doesNotMatch(persistedStateSource, /function flushRoomSnapshotState\(/);
  assert.doesNotMatch(persistedStateSource, /function getRoomSnapshotEntry\(/);
  assert.doesNotMatch(persistedStateSource, /function setRoomSnapshotEntry\(/);
  assert.match(snapshotRuntimeSource, /function createRoomSnapshotCacheRuntime\(/);
  assert.match(snapshotRuntimeSource, /require\('\.\/roomSnapshotCachePersistenceRuntime'\)/);
  assert.doesNotMatch(snapshotRuntimeSource, /function sanitizeRoomSnapshotMessage\(/);
  assert.doesNotMatch(snapshotRuntimeSource, /function pruneRoomSnapshotEntries\(/);
  assert.doesNotMatch(snapshotRuntimeSource, /function loadRoomSnapshotState\(/);
  assert.doesNotMatch(snapshotRuntimeSource, /function flushRoomSnapshotState\(/);
  assert.match(snapshotPersistenceSource, /require\('\.\/roomSnapshotCacheLoadRuntime'\)/);
  assert.match(snapshotPersistenceSource, /require\('\.\/roomSnapshotCacheFlushRuntime'\)/);
  assert.match(snapshotPersistenceSource, /require\('\.\/roomSnapshotCacheModel'\)/);
  assert.match(snapshotLoadSource, /function loadRoomSnapshotState\(/);
  assert.match(snapshotFlushSource, /function flushRoomSnapshotState\(/);
  assert.match(snapshotModelSource, /function sanitizeRoomSnapshotMessage\(/);
  assert.match(snapshotModelSource, /function pruneRoomSnapshotEntries\(/);
});
