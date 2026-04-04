const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CORE_SCHEMA_SQL,
  SOCIAL_SCHEMA_SQL,
  initCoreTables,
  initSocialTables,
  initTables,
} = require('../../../server/src/startup/schemaBootstrap');

test('schema bootstrap core SQL keeps the canonical table set', () => {
  assert.match(CORE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS users/i);
  assert.match(CORE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS messages/i);
  assert.match(CORE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS voice_channels/i);
  assert.match(CORE_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS addons/i);
});

test('schema bootstrap social SQL keeps the canonical contacts and friend request tables', () => {
  assert.match(SOCIAL_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS contacts/i);
  assert.match(SOCIAL_SCHEMA_SQL, /CREATE TABLE IF NOT EXISTS friend_requests/i);
  assert.match(SOCIAL_SCHEMA_SQL, /CREATE INDEX IF NOT EXISTS idx_fr_to/i);
});

test('schema bootstrap init helpers execute the expected schema batches', () => {
  const calls = [];
  const db = {
    exec(sql) {
      calls.push(sql);
    },
  };

  initCoreTables({ db });
  initSocialTables({ db });

  assert.equal(calls.length, 2);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS users/i);
  assert.match(calls[1], /CREATE TABLE IF NOT EXISTS contacts/i);
});

test('schema bootstrap initTables runs both the core and social schema bootstraps', () => {
  const calls = [];
  const db = {
    exec(sql) {
      calls.push(sql);
    },
  };

  initTables({ db });

  assert.equal(calls.length, 2);
  assert.match(calls[0], /CREATE TABLE IF NOT EXISTS users/i);
  assert.match(calls[1], /CREATE TABLE IF NOT EXISTS friend_requests/i);
});
