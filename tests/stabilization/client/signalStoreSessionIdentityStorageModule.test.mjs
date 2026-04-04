import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate shared session and identity storage mechanics to the helper module', async () => {
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
    new URL('../../../client/electron/crypto/signalStoreSessionIdentityStorage.js', import.meta.url),
    'utf8'
  );
  const identityMethodsSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreIdentityMethods.js', import.meta.url),
    'utf8'
  );
  const sessionMethodsSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreSessionMethods.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalStoreSessionIdentityStorage'\)/);
  assert.match(memorySource, /require\('\.\/signalStoreSessionIdentityStorage'\)/);
  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(builderSource, /require\('\.\/signalStoreSessionMethods'\)/);
  assert.match(sessionMethodsSource, /serializeSessionRecord\(/);
  assert.match(sessionMethodsSource, /deserializeSessionRecord\(/);
  assert.match(identityMethodsSource, /deserializeLocalIdentityKeyPair\(/);
  assert.match(identityMethodsSource, /getStoredLocalIdentityKeyPair\(/);
  assert.match(helperSource, /function serializeSessionRecord\(/);
  assert.match(helperSource, /function serializeLocalIdentityKeyPair\(/);
  assert.match(helperSource, /async function collectExistingSessions\(/);
});
