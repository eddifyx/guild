import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates app IPC and utility wiring to the dedicated Electron IPC runtime module', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const bindingsSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntimeBindings.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const supportSource = await readFile(
    new URL('../../../client/electron/electronIpcSupportRuntime.js', import.meta.url),
    'utf8'
  );
  const assetSource = await readFile(
    new URL('../../../client/electron/electronIpcAssetRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/electronIpcRuntime'\)/);
  assert.match(mainSource, /createElectronIpcRuntime\(/);
  assert.match(mainSource, /registerIpcHandlers\(/);
  assert.doesNotMatch(mainSource, /function recordPerfSample\(/);
  assert.doesNotMatch(mainSource, /function appendDebugLog\(/);
  assert.doesNotMatch(mainSource, /function resolveAssetPath\(/);
  assert.doesNotMatch(mainSource, /function requireTrustedMainWindowSender\(/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\('window-minimize'/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\('system-notification:show'/);
  assert.match(runtimeSource, /function createElectronIpcRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(runtimeSource, /require\('\.\/electronIpcSupportRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function registerIpcHandlers\(/);
  assert.match(registrationRuntimeSource, /function createElectronIpcRegistrationRuntime\(/);
  assert.match(registrationRuntimeSource, /function registerIpcHandlers\(/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronIpcRuntimeBindings'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronAppControlIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerAppControlIpcHandlers\(/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronCaptureIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerCaptureIpcHandlers\(/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronPersistedStateIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerPersistedStateIpcHandlers\(/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronSystemIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerSystemIpcHandlers\(/);
  assert.match(bindingsSource, /function createTrustedSenderGuard\(/);
  assert.match(bindingsSource, /function buildAppControlIpcOptions\(/);
  assert.match(supportSource, /function createElectronIpcSupportRuntime\(/);
  assert.match(supportSource, /require\('\.\/electronIpcAssetRuntime'\)/);
  assert.match(assetSource, /function isSafeExternalHttpUrl\(/);
});
