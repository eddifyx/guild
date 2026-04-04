import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('room snapshot flush runtime owns persisted room snapshot state writes', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const flushSource = await readFile(
    new URL('../../../client/electron/roomSnapshotCacheFlushRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/roomSnapshotCacheFlushRuntime'\)/);
  assert.match(flushSource, /function createRoomSnapshotCacheFlushRuntime\(/);
  assert.match(flushSource, /function flushRoomSnapshotState\(/);
  assert.match(flushSource, /function flushAllRoomSnapshotStates\(/);
});
