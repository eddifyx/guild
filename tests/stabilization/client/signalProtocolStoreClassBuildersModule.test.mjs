import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate shared session and identity class scaffolding to the class builder module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const builderSource = await readFile(
    new URL('../../../client/electron/crypto/signalProtocolStoreClassBuilders.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(sqliteSource, /createSessionStoreClass\(/);
  assert.match(sqliteSource, /createIdentityKeyStoreClass\(/);
  assert.match(memorySource, /createSessionStoreClass\(/);
  assert.match(memorySource, /createIdentityKeyStoreClass\(/);
  assert.match(builderSource, /function createSessionStoreClass\(/);
  assert.match(builderSource, /saveStoredSession\(/);
  assert.match(builderSource, /function createIdentityKeyStoreClass\(/);
  assert.match(builderSource, /approveStoredIdentity\(/);
});
