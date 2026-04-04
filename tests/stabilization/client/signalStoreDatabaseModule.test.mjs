import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('sqlite signal store delegates database bootstrap and migration to the shared helper module', async () => {
  const sqliteSource = await readFile(
    new URL('../../../client/electron/crypto/signalStore.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreDatabase.js', import.meta.url),
    'utf8'
  );
  const schemaSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreDatabaseSchema.js', import.meta.url),
    'utf8'
  );

  assert.match(sqliteSource, /require\('\.\/signalStoreDatabase'\)/);
  assert.match(sqliteSource, /openSignalStoreDatabase\(userId\)/);
  assert.match(runtimeSource, /require\('\.\/signalStoreDatabaseSchema'\)/);
  assert.match(runtimeSource, /function openSignalStoreDatabase\(/);
  assert.match(schemaSource, /function ensureSignalStoreColumn\(/);
  assert.match(schemaSource, /function migrateSignalStoreDatabase\(/);
});
