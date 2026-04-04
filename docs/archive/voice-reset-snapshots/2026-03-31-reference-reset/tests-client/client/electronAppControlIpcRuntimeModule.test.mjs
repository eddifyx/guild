import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC runtime delegates window and app-control handlers to the dedicated app control IPC runtime module', async () => {
  const ipcRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const appControlSource = await readFile(
    new URL('../../../client/electron/electronAppControlIpcRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronAppControlIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerAppControlIpcHandlers\(/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('window-minimize'/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('get-app-version'/);

  assert.match(appControlSource, /function registerAppControlIpcHandlers\(/);
  assert.match(appControlSource, /ipcMain\.handle\('window-minimize'/);
  assert.match(appControlSource, /ipcMain\.handle\('get-app-version'/);
});
