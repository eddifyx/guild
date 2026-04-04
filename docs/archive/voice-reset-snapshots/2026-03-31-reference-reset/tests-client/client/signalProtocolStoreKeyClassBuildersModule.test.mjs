import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate shared prekey, Kyber, and sender-key class scaffolding to the key class builder module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const builderSource = await readFile(
    new URL('../../../client/electron/crypto/signalProtocolStoreKeyClassBuilders.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreKeyClassBuilders'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreKeyClassBuilders'\)/);
  assert.match(sqliteSource, /createPreKeyStoreClass\(/);
  assert.match(sqliteSource, /createSignedPreKeyStoreClass\(/);
  assert.match(sqliteSource, /createKyberPreKeyStoreClass\(/);
  assert.match(sqliteSource, /createSenderKeyStoreClass\(/);
  assert.match(memorySource, /createPreKeyStoreClass\(/);
  assert.match(memorySource, /createSenderKeyStoreClass\(/);
  assert.match(builderSource, /function createPreKeyStoreClass\(/);
  assert.match(builderSource, /function createKyberPreKeyStoreClass\(/);
  assert.match(builderSource, /function createSenderKeyStoreClass\(/);
});
