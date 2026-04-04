import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC runtime delegates utility, notification, and update handlers to the dedicated system IPC runtime module', async () => {
  const ipcRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const systemSource = await readFile(
    new URL('../../../client/electron/electronSystemIpcRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronSystemIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerSystemIpcHandlers\(/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('system-notification:show'/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('download-update'/);

  assert.match(systemSource, /function registerSystemIpcHandlers\(/);
  assert.match(systemSource, /ipcMain\.handle\('system-notification:show'/);
  assert.match(systemSource, /ipcMain\.handle\('download-update'/);
});
