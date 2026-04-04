import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  SIGNAL_STORE_SCHEMA,
  ensureSignalStoreColumn,
  migrateSignalStoreDatabase,
} = require('../../../client/electron/crypto/signalStoreDatabaseSchema.js');

test('signal store database schema exports the canonical sqlite schema', () => {
  assert.match(SIGNAL_STORE_SCHEMA, /CREATE TABLE IF NOT EXISTS local_identity/);
  assert.match(SIGNAL_STORE_SCHEMA, /CREATE TABLE IF NOT EXISTS sender_keys/);
  assert.match(SIGNAL_STORE_SCHEMA, /CREATE TABLE IF NOT EXISTS room_distribution/);
});

test('signal store database schema ensures missing columns and migrates identity schema canonically', () => {
  const addedColumns = [];
  const db = {
    prepare(sql) {
      if (sql === 'PRAGMA table_info(identity_keys)') {
        return {
          all() {
            return [{ name: 'address' }, { name: 'public_key' }];
          },
        };
      }

      return {
        run() {
          addedColumns.push(sql);
        },
      };
    },
  };

  ensureSignalStoreColumn(db, 'identity_keys', 'verified', 'INTEGER NOT NULL DEFAULT 0');
  migrateSignalStoreDatabase(db);

  assert.deepEqual(addedColumns, [
    'ALTER TABLE identity_keys ADD COLUMN verified INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE identity_keys ADD COLUMN verified INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE identity_keys ADD COLUMN first_seen INTEGER',
    'ALTER TABLE identity_keys ADD COLUMN last_seen INTEGER',
  ]);
});
