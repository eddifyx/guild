import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates auth backup persistence to the dedicated runtime module', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/authBackupRuntime.js', import.meta.url),
    'utf8'
  );
  const persistedStateSource = await readFile(
    new URL('../../../client/electron/persistedStateRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/authBackupRuntime'\)/);
  assert.match(mainSource, /require\('\.\/persistedStateRuntime'\)/);
  assert.match(mainSource, /app\.isPackaged/);
  assert.match(mainSource, /createAuthBackupRuntime\(/);
  assert.match(mainSource, /createPersistedStateRuntime\(/);
  assert.doesNotMatch(mainSource, /function readAuthBackup\(/);
  assert.doesNotMatch(mainSource, /function writeAuthBackup\(/);
  assert.doesNotMatch(mainSource, /function clearAuthBackup\(/);
  assert.match(runtimeSource, /function createAuthBackupRuntime\(/);
  assert.match(runtimeSource, /function normalizeAuthBackup\(/);
  assert.match(persistedStateSource, /createPersistedAuthBackupRuntime\(/);
  assert.match(runtimeSource, /module\.exports = \{/);
});
