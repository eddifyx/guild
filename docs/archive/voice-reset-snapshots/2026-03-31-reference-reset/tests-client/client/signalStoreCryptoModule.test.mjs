import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate at-rest crypto through shared helper modules', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const keyPersistenceSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreKeyPersistence.js', import.meta.url),
    'utf8'
  );
  const sessionIdentitySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreSessionIdentityStorage.js', import.meta.url),
    'utf8'
  );
  const cryptoSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreCrypto.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalStoreKeyPersistence'\)/);
  assert.match(memorySource, /require\('\.\/signalStoreKeyPersistence'\)/);
  assert.match(sqliteSource, /require\('\.\/signalStoreSessionIdentityStorage'\)/);
  assert.match(memorySource, /require\('\.\/signalStoreSessionIdentityStorage'\)/);
  assert.doesNotMatch(sqliteSource, /function encrypt\(/);
  assert.doesNotMatch(sqliteSource, /function decrypt\(/);
  assert.doesNotMatch(memorySource, /function encrypt\(/);
  assert.doesNotMatch(memorySource, /function decrypt\(/);
  assert.match(keyPersistenceSource, /require\('\.\/signalStoreCrypto'\)/);
  assert.match(sessionIdentitySource, /require\('\.\/signalStoreCrypto'\)/);
  assert.match(cryptoSource, /function encryptAtRest\(/);
  assert.match(cryptoSource, /function decryptAtRest\(/);
});
