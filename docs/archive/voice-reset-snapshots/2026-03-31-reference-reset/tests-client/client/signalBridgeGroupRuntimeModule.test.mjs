import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal bridge delegates sender-key and group handlers to the dedicated runtime module', async () => {
  const bridgeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridge.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridgeGroupRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(bridgeSource, /require\('\.\/signalBridgeGroupRuntime'\)/);
  assert.match(bridgeSource, /registerSignalBridgeGroupHandlers\(/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:create-skdm'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:process-skdm'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:group-encrypt'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:group-decrypt'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:rekey-room'/);
  assert.match(runtimeSource, /function registerSignalBridgeGroupHandlers\(/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:create-skdm'/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:group-decrypt'/);
});
