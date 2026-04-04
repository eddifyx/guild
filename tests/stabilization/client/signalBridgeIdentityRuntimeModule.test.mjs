import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal bridge delegates identity, session, and fingerprint handlers to the dedicated runtime module', async () => {
  const bridgeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridge.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridgeIdentityRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(bridgeSource, /require\('\.\/signalBridgeIdentityRuntime'\)/);
  assert.match(bridgeSource, /registerSignalBridgeIdentityHandlers\(/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:get-identity-state'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:approve-identity'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:mark-identity-verified'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:has-session'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:delete-session'/);
  assert.doesNotMatch(bridgeSource, /ipcMain\.handle\('signal:get-fingerprint'/);
  assert.match(runtimeSource, /function registerSignalBridgeIdentityHandlers\(/);
  assert.match(runtimeSource, /ipcMain\.handle\(\s*'signal:get-identity-state'/);
  assert.match(runtimeSource, /ipcMain\.handle\('signal:get-fingerprint'/);
});
