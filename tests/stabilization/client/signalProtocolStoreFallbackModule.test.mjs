import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sqlite signal store delegates fallback policy and store creation to the shared helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalProtocolStoreFallback.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreFallback'\)/);
  assert.match(sqliteSource, /createProtocolStoreWithFallback\(/);
  assert.match(sqliteSource, /shouldUseMemoryProtocolStoreFallback/);
  assert.match(helperSource, /function shouldUseMemoryProtocolStoreFallback\(/);
  assert.match(helperSource, /async function createProtocolStoreWithFallback\(/);
});
