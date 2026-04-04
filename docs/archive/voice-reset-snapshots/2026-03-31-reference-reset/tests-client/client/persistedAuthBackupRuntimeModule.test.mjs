import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('persisted state runtime delegates auth backup ownership to the dedicated auth backup runtime', async () => {
  const stateSource = await readFile(
    new URL('../../../client/electron/persistedStateRuntime.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
    new URL('../../../client/electron/persistedAuthBackupRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(stateSource, /require\('\.\/persistedAuthBackupRuntime'\)/);
  assert.match(stateSource, /createPersistedAuthBackupRuntime\(/);
  assert.match(stateSource, /\.\.\.authBackupRuntime/);
  assert.match(helperSource, /function createPersistedAuthBackupRuntime\(/);
  assert.match(helperSource, /function normalizeAuthBackup\(/);
  assert.match(helperSource, /function getAuthBackupFilePath\(/);
});
