const test = require('node:test');
const assert = require('node:assert/strict');

const {
  migrateUsersToAllowDuplicateUsernames,
} = require('../../../server/src/startup/databaseBootstrapMigrations');

test('database bootstrap migrations rewrite the users table when legacy unique usernames are present', () => {
  const calls = [];
  const db = {
    prepare(sql) {
      calls.push(['prepare', sql]);
      if (sql === "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'") {
        return {
          get() {
            return { sql: 'CREATE TABLE users (username TEXT NOT NULL UNIQUE)' };
          },
        };
      }
      if (sql === 'PRAGMA table_info(users)') {
        return {
          all() {
            return [
              { name: 'id' },
              { name: 'username' },
              { name: 'avatar_color' },
            ];
          },
        };
      }
      return {
        get() {
          return null;
        },
        all() {
          return [];
        },
        run() {
          calls.push(['run', sql]);
          return { changes: 1 };
        },
      };
    },
    pragma(value) {
      calls.push(['pragma', value]);
    },
    exec(sql) {
      calls.push(['exec', sql]);
    },
    transaction(fn) {
      calls.push(['transaction']);
      return () => {
        calls.push(['transaction-run']);
        fn();
      };
    },
  };

  const result = migrateUsersToAllowDuplicateUsernames({ db, log: { log() {} } });

  assert.equal(result, true);
  assert.ok(calls.some(([kind, value]) => kind === 'pragma' && value === 'foreign_keys = OFF'));
  assert.ok(calls.some(([kind, value]) => kind === 'pragma' && value === 'foreign_keys = ON'));
  assert.ok(calls.some(([kind, value]) => kind === 'exec' && String(value).includes('CREATE TABLE users_new')));
  assert.ok(calls.some(([kind, value]) => kind === 'exec' && String(value).includes('ALTER TABLE users_new RENAME TO users')));
});
