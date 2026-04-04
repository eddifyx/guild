import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron startup app settings runtime owns app switches and single-instance lock setup', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronStartupRuntime.js', import.meta.url),
    'utf8'
  );
  const settingsSource = await readFile(
    new URL('../../../client/electron/electronStartupAppSettingsRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronStartupAppSettingsRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function applyBaseElectronAppSettings\(/);
  assert.match(settingsSource, /function applyBaseElectronAppSettings\(/);
});
