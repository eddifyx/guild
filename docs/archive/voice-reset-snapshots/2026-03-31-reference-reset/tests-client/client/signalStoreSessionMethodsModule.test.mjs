import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store implementations delegate shared session methods to the helper module', async () => {
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
    new URL('../../../client/electron/crypto/signalStoreSessionMethods.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(memorySource, /require\('\.\/signalProtocolStoreClassBuilders'\)/);
  assert.match(builderSource, /saveStoredSession\(/);
  assert.match(builderSource, /getExistingStoredSessions\(/);
  assert.match(helperSource, /async function saveStoredSession\(/);
  assert.match(helperSource, /async function getStoredSession\(/);
  assert.match(helperSource, /async function removeStoredSession\(/);
});
