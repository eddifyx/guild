import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC runtime delegates child registration ownership to the dedicated registration runtime module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /registerAppControlIpcHandlers\(/);
  assert.doesNotMatch(runtimeSource, /registerCaptureIpcHandlers\(/);
  assert.doesNotMatch(runtimeSource, /registerPersistedStateIpcHandlers\(/);
  assert.doesNotMatch(runtimeSource, /registerSystemIpcHandlers\(/);
  assert.doesNotMatch(runtimeSource, /function registerIpcHandlers\(/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronIpcRuntimeBindings'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronAppControlIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronCaptureIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronPersistedStateIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronSystemIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /function createElectronIpcRegistrationRuntime\(/);
  assert.match(registrationRuntimeSource, /function registerIpcHandlers\(/);
});
