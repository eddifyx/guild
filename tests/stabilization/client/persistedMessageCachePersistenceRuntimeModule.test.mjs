import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted message cache persistence runtime owns state load and flush lifecycle', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheRuntime.js', import.meta.url),
    'utf8'
  );
  const persistenceSource = await readFile(
    new URL('../../../client/electron/persistedMessageCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const loadSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheLoadRuntime.js', import.meta.url),
    'utf8'
  );
  const flushSource = await readFile(
    new URL('../../../client/electron/persistedMessageCacheFlushRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/persistedMessageCachePersistenceRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(runtimeSource, /function flushMessageCacheState\(/);
  assert.doesNotMatch(runtimeSource, /function flushAllMessageCacheStates\(/);
  assert.match(persistenceSource, /require\('\.\/persistedMessageCacheLoadRuntime'\)/);
  assert.match(persistenceSource, /require\('\.\/persistedMessageCacheFlushRuntime'\)/);
  assert.doesNotMatch(persistenceSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(persistenceSource, /function flushMessageCacheState\(/);
  assert.doesNotMatch(persistenceSource, /function flushAllMessageCacheStates\(/);
  assert.match(loadSource, /function loadMessageCacheState\(/);
  assert.match(flushSource, /function flushMessageCacheState\(/);
  assert.match(flushSource, /function flushAllMessageCacheStates\(/);
});
