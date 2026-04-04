import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron message cache persistence runtime delegates lifecycle ownership to the dedicated state runtime', async () => {
  const runtimeSource = await readFile(
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

  assert.match(runtimeSource, /require\('\.\/messageCachePersistenceStateRuntime'\)/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCachePersistenceLoadRuntime'\)/);
  assert.match(stateRuntimeSource, /require\('\.\/messageCachePersistenceFlushRuntime'\)/);
  assert.doesNotMatch(stateRuntimeSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(stateRuntimeSource, /function flushMessageCacheState\(/);
  assert.match(stateRuntimeSource, /function scheduleMessageCacheFlush\(/);
  assert.match(loadRuntimeSource, /function loadMessageCacheState\(/);
  assert.match(flushRuntimeSource, /function flushMessageCacheState\(/);
});
