import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted message cache load runtime owns persisted cache state reads', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/persistedMessageCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const loadSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheLoadRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/persistedMessageCacheLoadRuntime'\)/);
  assert.match(loadSource, /function createPersistedMessageCacheLoadRuntime\(/);
  assert.match(loadSource, /function loadMessageCacheState\(/);
  assert.match(loadSource, /require\('\.\/persistedMessageCacheModel'\)/);
});
