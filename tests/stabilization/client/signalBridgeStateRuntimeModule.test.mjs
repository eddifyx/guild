import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('signal bridge delegates local state helpers to the dedicated runtime module', async () => {
  const bridgeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridge.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/crypto/signalBridgeStateRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(bridgeSource, /require\('\.\/signalBridgeStateRuntime'\)/);
  assert.match(bridgeSource, /createSignalBridgeStateRuntime\(/);
  assert.doesNotMatch(bridgeSource, /function getMasterKey\(/);
  assert.doesNotMatch(bridgeSource, /function getOrCreateLocalDeviceId\(/);
  assert.doesNotMatch(bridgeSource, /function persistLocalDeviceId\(/);
  assert.doesNotMatch(bridgeSource, /function resetSignalProtocolStore\(/);
  assert.match(runtimeSource, /function createSignalBridgeStateRuntime\(/);
  assert.match(runtimeSource, /function normalizeDeviceId\(/);
  assert.match(runtimeSource, /function getMasterKey\(/);
});
