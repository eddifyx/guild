import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal store database runtime delegates schema and migration ownership to the schema helper module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreDatabase.js', import.meta.url),
    'utf8'
  );
  const schemaSource = await readFile(
    new URL('../../../client/electron/crypto/signalStoreDatabaseSchema.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/signalStoreDatabaseSchema'\)/);
  assert.match(runtimeSource, /SIGNAL_STORE_SCHEMA/);
  assert.match(runtimeSource, /migrateSignalStoreDatabase\(db\)/);
  assert.match(schemaSource, /const SIGNAL_STORE_SCHEMA = `/);
  assert.match(schemaSource, /function ensureSignalStoreColumn\(/);
  assert.match(schemaSource, /function migrateSignalStoreDatabase\(/);
});
