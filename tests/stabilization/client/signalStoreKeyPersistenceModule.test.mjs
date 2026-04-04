import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate shared key persistence mechanics to the helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreKeyPersistence.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalStoreKeyPersistence'\)/);
  assert.match(memorySource, /require\('\.\/signalStoreKeyPersistence'\)/);
  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreKeyClassBuilders'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreKeyClassBuilders'\)/);
  assert.match(sqliteSource, /\bserializePreKeyRecord\b/);
  assert.match(memorySource, /\bdeserializeSignedPreKeyRecord\b/);
  assert.match(sqliteSource, /\bserializeSenderKeyRecord\b/);
  assert.match(memorySource, /\bdeserializeSenderKeyRecord\b/);
  assert.match(memorySource, /getSortedUnusedMapKeyIds\(/);
  assert.match(helperSource, /function serializeStoredRecord\(/);
  assert.match(helperSource, /function serializePreKeyRecord\(/);
  assert.match(helperSource, /function deserializeKyberPreKeyRecord\(/);
  assert.match(helperSource, /function serializeSenderKeyRecord\(/);
  assert.match(helperSource, /function buildSenderKeyStorageKey\(/);
  assert.match(helperSource, /function getSortedUnusedMapKeyIds\(/);
});
