import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal bridge delegates bundle export and replenishment handlers to the dedicated runtime module', async () => {
  const bridgeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridge.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridgeBundleRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(bridgeSource, /require\('\.\/signalBridgeBundleRuntime'\)/);
  assert.match(bridgeSource, /registerSignalBridgeBundleHandlers\(/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:get-bundle'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:replenish-otps'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:replenish-kyber'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:otp-count'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:kyber-count'/);
  assert.match(runtimeSource, /function registerSignalBridgeBundleHandlers\(/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:get-bundle'/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:replenish-otps'/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:kyber-count'/);
});
