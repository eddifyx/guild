const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('db module delegates runtime and repository wiring to dedicated modules', () => {
  const dbSource = readFileSync(
    '/Users/eddifyx/Documents/Projects/guild-main/server/src/db.js',
    'utf8'
  );
  const runtimeSource = readFileSync(
    '/Users/eddifyx/Documents/Projects/guild-main/server/src/dbRuntime.js',
    'utf8'
  );
  const bindingsSource = readFileSync(
    '/Users/eddifyx/Documents/Projects/guild-main/server/src/dbBindings.js',
    'utf8'
  );

  assert.match(dbSource, /require\('\.\/dbBindings'\)/);
  assert.match(dbSource, /require\('\.\/dbRuntime'\)/);
  assert.match(runtimeSource, /function hashToken/);
  assert.match(runtimeSource, /function hashColor/);
  assert.match(bindingsSource, /function createDbBindings/);
  assert.match(bindingsSource, /insertEncryptedMessage/);
});
