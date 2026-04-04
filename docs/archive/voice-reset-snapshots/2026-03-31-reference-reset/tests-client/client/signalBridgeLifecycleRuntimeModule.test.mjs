import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal bridge delegates lifecycle and device-id handlers to the dedicated runtime module', async () => {
  const bridgeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridge.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridgeLifecycleRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(bridgeSource, /require\('\.\/signalBridgeLifecycleRuntime'\)/);
  assert.match(bridgeSource, /registerSignalBridgeLifecycleHandlers\(/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:initialize'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:destroy'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:get-device-id'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:set-device-id'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:allocate-device-id'/);
  assert.match(runtimeSource, /function registerSignalBridgeLifecycleHandlers\(/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:initialize'/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:allocate-device-id'/);
});
