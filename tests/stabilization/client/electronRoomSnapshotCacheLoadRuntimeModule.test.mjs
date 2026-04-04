import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('room snapshot load runtime owns persisted room snapshot state reads', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const loadSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheLoadRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/roomSnapshotCacheLoadRuntime'\)/);
  assert.match(loadSource, /function createRoomSnapshotCacheLoadRuntime\(/);
  assert.match(loadSource, /function loadRoomSnapshotState\(/);
  assert.match(loadSource, /require\('\.\/roomSnapshotCacheModel'\)/);
});
