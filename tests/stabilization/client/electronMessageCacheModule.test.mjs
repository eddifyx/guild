import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates message cache persistence to the dedicated runtime module', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/messageCacheRuntime.js', import.meta.url),
    'utf8'
  );
  const persistedStateSource = await readFile(
    new URL('../../../client/electron/persistedStateRuntime.js', import.meta.url),
    'utf8'
  );
  const persistenceSource = await readFile(
    new URL('../../../client/electron/messageCachePersistenceRuntime.js', import.meta.url),
    'utf8'
  );
  const stateRuntimeSource = await readFile(
    new URL('../../../client/electron/messageCachePersistenceStateRuntime.js', import.meta.url),
    'utf8'
  );
  const loadRuntimeSource = await readFile(
    new URL('../../../client/electron/messageCachePersistenceLoadRuntime.js', import.meta.url),
    'utf8'
  );
  const flushRuntimeSource = await readFile(
    new URL('../../../client/electron/messageCachePersistenceFlushRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/messageCacheModel.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/messageCacheRuntime'\)/);
  assert.match(mainSource, /require\('\.\/persistedStateRuntime'\)/);
  assert.match(mainSource, /app\.isPackaged/);
  assert.match(mainSource, /createMessageCacheRuntime\(/);
  assert.match(mainSource, /createPersistedStateRuntime\(/);
  assert.doesNotMatch(mainSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(mainSource, /function flushMessageCacheState\(/);
  assert.doesNotMatch(mainSource, /function serializeMessageCache\(/);
  assert.doesNotMatch(mainSource, /function deserializeMessageCache\(/);
  assert.match(persistedStateSource, /createPersistedMessageCacheRuntime\(/);
  assert.match(runtimeSource, /function createMessageCacheRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/messageCachePersistenceRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(runtimeSource, /function flushMessageCacheState\(/);
  assert.match(persistenceSource, /require\('\.\/messageCachePersistenceStateRuntime'\)/);
  assert.doesNotMatch(persistenceSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(persistenceSource, /function flushMessageCacheState\(/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCacheModel'\)/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCachePersistenceLoadRuntime'\)/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCachePersistenceFlushRuntime'\)/);
  assert.doesNotMatch(stateRuntimeSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(stateRuntimeSource, /function flushMessageCacheState\(/);
  assert.match(loadRuntimeSource, /function loadMessageCacheState\(/);
  assert.match(flushRuntimeSource, /function flushMessageCacheState\(/);
  assert.doesNotMatch(stateRuntimeSource, /function pruneMessageCacheEntries\(/);
  assert.match(modelSource, /function pruneMessageCacheEntries\(/);
  assert.match(runtimeSource, /module\.exports = \{/);
});
