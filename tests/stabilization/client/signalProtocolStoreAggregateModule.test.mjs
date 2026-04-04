import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate aggregate store wiring to the shared helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalProtocolStoreAggregate.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreAggregate'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreAggregate'\)/);
  assert.match(sqliteSource, /createProtocolStoreClass\(/);
  assert.match(memorySource, /createProtocolStoreClass\(/);
  assert.match(sqliteSource, /initializeStoreState:/);
  assert.match(memorySource, /initializeStoreState:/);
  assert.match(sqliteSource, /createMemberFactories:/);
  assert.match(memorySource, /createMemberFactories:/);
  assert.match(helperSource, /function createProtocolStoreClass\(/);
  assert.match(helperSource, /function createProtocolStoreMembers\(/);
  assert.match(helperSource, /async function removeProtocolStoreSession\(/);
  assert.match(helperSource, /function closeProtocolStoreState\(/);
});
