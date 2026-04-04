const test = require('node:test');
const assert = require('node:assert/strict');

const {
  tableSqlHasUniqueUsernameConstraint,
  usersTableHasUniqueUsernameConstraint,
  pickGuildMembershipToKeep,
} = require('../../../server/src/startup/databaseBootstrapModel');

test('database bootstrap model detects legacy unique username table definitions', () => {
  assert.equal(tableSqlHasUniqueUsernameConstraint('CREATE TABLE users (username TEXT NOT NULL UNIQUE)'), true);
  assert.equal(tableSqlHasUniqueUsernameConstraint('CREATE TABLE users (username TEXT NOT NULL, UNIQUE (username))'), true);
  assert.equal(tableSqlHasUniqueUsernameConstraint('CREATE TABLE users (username TEXT NOT NULL)'), false);
});

test('database bootstrap model reads the users table SQL constraint from sqlite metadata', () => {
  const db = {
    prepare(sql) {
      assert.equal(sql, "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'");
      return {
        get() {
          return { sql: 'CREATE TABLE users (username TEXT NOT NULL UNIQUE)' };
        },
      };
    },
  };

  assert.equal(usersTableHasUniqueUsernameConstraint({ db }), true);
});

test('database bootstrap model prefers guild-master membership over recency when enforcing single-guild mode', () => {
  assert.equal(
    pickGuildMembershipToKeep({ guildMasterGuildId: 'guild-gm', latestGuildId: 'guild-latest' }),
    'guild-gm'
  );
  assert.equal(
    pickGuildMembershipToKeep({ guildMasterGuildId: null, latestGuildId: 'guild-latest' }),
    'guild-latest'
  );
  assert.equal(
    pickGuildMembershipToKeep({ guildMasterGuildId: null, latestGuildId: null }),
    null
  );
});
