import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted state runtime delegates message cache ownership to the dedicated message cache runtime', async () => {
  const stateSource = await readFile(
    new URL('../../../client/electron/persistedStateRuntime.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
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

  assert.match(stateSource, /require\('\.\/persistedMessageCacheRuntime'\)/);
  assert.match(stateSource, /createPersistedMessageCacheRuntime\(/);
  assert.match(stateSource, /\.\.\.messageCacheRuntime/);
  assert.match(helperSource, /function createPersistedMessageCacheRuntime\(/);
  assert.match(helperSource, /require\('\.\/persistedMessageCachePersistenceRuntime'\)/);
  assert.doesNotMatch(helperSource, /function loadMessageCacheState\(/);
  assert.doesNotMatch(helperSource, /function flushMessageCacheState\(/);
  assert.match(persistenceSource, /require\('\.\/persistedMessageCacheLoadRuntime'\)/);
  assert.match(persistenceSource, /require\('\.\/persistedMessageCacheFlushRuntime'\)/);
  assert.match(loadSource, /function loadMessageCacheState\(/);
  assert.match(flushSource, /function flushMessageCacheState\(/);
});
