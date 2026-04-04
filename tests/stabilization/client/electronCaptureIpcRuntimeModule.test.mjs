import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC runtime delegates capture and desktop-source handler wiring to the dedicated capture IPC runtime module', async () => {
  const ipcRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const captureIpcSource = await readFile(
    new URL('../../../client/electron/electronCaptureIpcRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronCaptureIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerCaptureIpcHandlers\(/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('apple-voice-capture-supported'/);
  assert.doesNotMatch(ipcRuntimeSource, /ipcMain\.handle\('prefetch-desktop-sources'/);

  assert.match(captureIpcSource, /function registerCaptureIpcHandlers\(/);
  assert.match(captureIpcSource, /ipcMain\.handle\('apple-voice-capture-supported'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('prefetch-desktop-sources'/);
});
