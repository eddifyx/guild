import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildSignalStoreDatabasePath,
  openSignalStoreDatabase,
} = require('../../../client/electron/crypto/signalStoreDatabase.js');
const {
  SIGNAL_STORE_SCHEMA,
} = require('../../../client/electron/crypto/signalStoreDatabaseSchema.js');

test('signal store database builds the canonical sqlite path', () => {
  assert.equal(
    buildSignalStoreDatabasePath('user-42', '/tmp/guild-userdata'),
    '/tmp/guild-userdata/signal-protocol-user-42.db'
  );
});

test('signal store database opens sqlite with the canonical pragmas and migration flow', () => {
  const calls = [];

  class FakeDatabase {
    constructor(dbPath) {
      this.dbPath = dbPath;
      calls.push(['construct', dbPath]);
    }

    pragma(value) {
      calls.push(['pragma', value]);
    }

    exec(value) {
      calls.push(['exec', value]);
    }

    prepare(sql) {
      calls.push(['prepare', sql]);
      if (sql === 'PRAGMA table_info(identity_keys)') {
        return {
          all() {
            calls.push(['all', sql]);
            return [{ name: 'address' }, { name: 'public_key' }, { name: 'verified' }];
          },
        };
      }

      return {
        run() {
          calls.push(['run', sql]);
        },
      };
    }
  }

  const db = openSignalStoreDatabase('user-99', {
    Database: FakeDatabase,
    dbPath: '/tmp/signal-protocol-user-99.db',
  });

  assert.equal(db.dbPath, '/tmp/signal-protocol-user-99.db');
  assert.deepEqual(calls.slice(0, 4), [
    ['construct', '/tmp/signal-protocol-user-99.db'],
    ['pragma', 'journal_mode = WAL'],
    ['pragma', 'foreign_keys = ON'],
    ['exec', SIGNAL_STORE_SCHEMA],
  ]);
  assert.ok(calls.some(([type, sql]) => type === 'run' && sql.includes('ADD COLUMN first_seen')));
  assert.ok(calls.some(([type, sql]) => type === 'run' && sql.includes('ADD COLUMN last_seen')));
});
