import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate protocol-store member factories to the shared helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalProtocolStoreMemberFactories.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreMemberFactories'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreMemberFactories'\)/);
  assert.match(sqliteSource, /createSQLiteProtocolStoreMemberFactories\(/);
  assert.match(memorySource, /createMemoryProtocolStoreMemberFactories\(/);
  assert.match(helperSource, /function createSQLiteProtocolStoreMemberFactories\(/);
  assert.match(helperSource, /function createMemoryProtocolStoreMemberFactories\(/);
});
