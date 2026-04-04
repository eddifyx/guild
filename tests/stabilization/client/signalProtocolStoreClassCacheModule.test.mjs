import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate async class caching to the shared helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalProtocolStoreClassCache.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreClassCache'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreClassCache'\)/);
  assert.match(sqliteSource, /createCachedAsyncLoader\(/);
  assert.match(memorySource, /createCachedAsyncLoader\(/);
  assert.match(helperSource, /function createCachedAsyncLoader\(/);
});
