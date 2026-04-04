import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron room snapshot cache persistence runtime owns state load and flush lifecycle', async () => {
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

  assert.match(runtimeSource, /require\('\.\/roomSnapshotCachePersistenceRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function loadRoomSnapshotState\(/);
  assert.doesNotMatch(runtimeSource, /function flushRoomSnapshotState\(/);
  assert.doesNotMatch(runtimeSource, /function flushAllRoomSnapshotStates\(/);
  assert.match(persistenceSource, /require\('\.\/roomSnapshotCacheLoadRuntime'\)/);
  assert.match(persistenceSource, /require\('\.\/roomSnapshotCacheFlushRuntime'\)/);
  assert.doesNotMatch(persistenceSource, /function loadRoomSnapshotState\(/);
  assert.doesNotMatch(persistenceSource, /function flushRoomSnapshotState\(/);
  assert.doesNotMatch(persistenceSource, /function flushAllRoomSnapshotStates\(/);
  assert.match(loadSource, /function loadRoomSnapshotState\(/);
  assert.match(flushSource, /function flushRoomSnapshotState\(/);
  assert.match(flushSource, /function flushAllRoomSnapshotStates\(/);
});
