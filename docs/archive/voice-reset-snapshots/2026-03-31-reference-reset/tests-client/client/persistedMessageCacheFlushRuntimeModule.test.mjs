import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted message cache flush runtime owns persisted cache state writes', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/persistedMessageCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const flushSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheFlushRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/persistedMessageCacheFlushRuntime'\)/);
  assert.match(flushSource, /function createPersistedMessageCacheFlushRuntime\(/);
  assert.match(flushSource, /function flushMessageCacheState\(/);
  assert.match(flushSource, /function flushAllMessageCacheStates\(/);
  assert.match(flushSource, /require\('\.\/persistedMessageCacheModel'\)/);
});
