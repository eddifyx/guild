import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron room snapshot cache runtime delegates pure snapshot helpers to the dedicated model module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheRuntime.js', import.meta.url),
    'utf8'
  );
  const persistenceSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const loadSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheLoadRuntime.js', import.meta.url),
    'utf8'
  );
  const flushSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheFlushRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/roomSnapshotCachePersistenceRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function getRoomSnapshotCacheFilePath\(/);
  assert.doesNotMatch(runtimeSource, /function sanitizeRoomSnapshotMessage\(/);
  assert.doesNotMatch(runtimeSource, /function pruneRoomSnapshotEntries\(/);
  assert.match(persistenceSource, /require\('\.\/roomSnapshotCacheModel'\)/);
  assert.match(loadSource, /require\('\.\/roomSnapshotCacheModel'\)/);
  assert.doesNotMatch(flushSource, /require\('\.\/roomSnapshotCacheModel'\)/);
  assert.doesNotMatch(persistenceSource, /function getRoomSnapshotCacheFilePath\(/);
  assert.doesNotMatch(persistenceSource, /function sanitizeRoomSnapshotMessage\(/);
  assert.doesNotMatch(persistenceSource, /function pruneRoomSnapshotEntries\(/);
  assert.match(modelSource, /function getRoomSnapshotCacheFilePath\(/);
  assert.match(modelSource, /function sanitizeRoomSnapshotMessage\(/);
  assert.match(modelSource, /function pruneRoomSnapshotEntries\(/);
});
