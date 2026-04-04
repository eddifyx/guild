import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC runtime delegates persisted-state handler wiring to the dedicated persisted-state IPC runtime module', async () => {
  const ipcRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const persistedStateIpcSource = await readFile(
    new URL('../../../client/electron/electronPersistedStateIpcRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronPersistedStateIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerPersistedStateIpcHandlers\(/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('message-cache:get'/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.on\('auth-state:get-sync'/);

  assert.match(persistedStateIpcSource, /function registerPersistedStateIpcHandlers\(/);
  assert.match(persistedStateIpcSource, /ipcMain\.handle\('message-cache:get'/);
  assert.match(persistedStateIpcSource, /ipcMain\.on\('auth-state:get-sync'/);
  assert.match(persistedStateIpcSource, /ipcMain\.handle\('signer-state:get'/);
  assert.match(persistedStateIpcSource, /ipcMain\.handle\('signer-state:set'/);
  assert.match(persistedStateIpcSource, /ipcMain\.handle\('signer-state:clear'/);
});
