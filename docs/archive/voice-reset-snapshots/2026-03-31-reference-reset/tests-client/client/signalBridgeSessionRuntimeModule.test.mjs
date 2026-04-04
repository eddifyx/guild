import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal bridge delegates session-establishment and DM handlers to the dedicated runtime module', async () => {
  const bridgeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridge.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridgeSessionRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(bridgeSource, /require\('\.\/signalBridgeSessionRuntime'\)/);
  assert.match(bridgeSource, /registerSignalBridgeSessionHandlers\(/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:process-bundle'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:encrypt'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:decrypt'/);
  assert.match(runtimeSource, /function registerSignalBridgeSessionHandlers\(/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:process-bundle'/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:decrypt'/);
});
