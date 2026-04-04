import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store identity helper delegates trust policy to the shared state module', async () => {
  const helperSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreIdentityMethods.js', import.meta.url),
    'utf8'
  );
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const memorySource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreMemory.js', import.meta.url),
    'utf8'
  );
  const identityStateSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreIdentityState.js', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(sqliteSource, /buildIdentityTrustState\(/);
  assert.doesNotMatch(memorySource, /buildIdentityTrustState\(/);
  assert.match(helperSource, /require\('\.\/signalStoreIdentityState'\)/);
  assert.match(helperSource, /buildIdentityTrustState\(/);
  assert.match(identityStateSource, /function buildApprovedIdentityState\(/);
  assert.match(identityStateSource, /function buildSavedIdentityState\(/);
  assert.match(identityStateSource, /function isTrustedIdentityRecord\(/);
});
