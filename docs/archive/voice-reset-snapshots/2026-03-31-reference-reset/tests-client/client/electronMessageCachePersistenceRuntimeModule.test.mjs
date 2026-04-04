import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron message cache persistence runtime delegates pure helpers to the model module', async () => {
  const source = await readFile(
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

  assert.match(source, /require\('\.\/messageCachePersistenceStateRuntime'\)/);
  assert.match(source, /function createMessageCachePersistenceRuntime\(/);
  assert.doesNotMatch(source, /function loadMessageCacheState\(/);
  assert.doesNotMatch(source, /function flushMessageCacheState\(/);
  assert.doesNotMatch(source, /function scheduleMessageCacheFlush\(/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCacheModel'\)/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCachePersistenceLoadRuntime'\)/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCachePersistenceFlushRuntime'\)/);
  assert.doesNotMatch(stateRuntimeSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(stateRuntimeSource, /function flushMessageCacheState\(/);
  assert.match(stateRuntimeSource, /function scheduleMessageCacheFlush\(/);
  assert.doesNotMatch(stateRuntimeSource, /function pruneMessageCacheEntries\(/);
  assert.doesNotMatch(stateRuntimeSource, /function serializeMessageCache\(/);
  assert.match(loadRuntimeSource, /function loadMessageCacheState\(/);
  assert.match(flushRuntimeSource, /function flushMessageCacheState\(/);
  assert.match(modelSource, /function pruneMessageCacheEntries\(/);
});
