import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron startup profile runtime owns profile path and partition setup', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronStartupRuntime.js', import.meta.url),
    'utf8'
  );
  const profileSource = await readFile(
    new URL('../../../client/electron/electronStartupProfileRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronStartupProfileRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function configureProfilePaths\(/);
  assert.match(profileSource, /function configureProfilePaths\(/);
});
