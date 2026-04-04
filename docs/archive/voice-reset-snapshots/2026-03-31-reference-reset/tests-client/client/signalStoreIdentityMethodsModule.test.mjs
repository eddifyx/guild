import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate shared identity methods to the helper module', async () => {
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
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreIdentityMethods.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(builderSource, /approveStoredIdentity\(/);
  assert.match(builderSource, /getStoredIdentityPrivateKey\(/);
  assert.match(helperSource, /function getStoredIdentityPrivateKey\(/);
  assert.match(helperSource, /async function approveStoredIdentity\(/);
  assert.match(helperSource, /async function saveStoredIdentity\(/);
});
