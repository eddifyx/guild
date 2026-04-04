import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC support runtime owns the shared support helpers used by the Electron IPC shell', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
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
  const perfSource = await readFile(
    new URL('../../../client/electron/electronIpcPerfRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronIpcSupportRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function recordPerfSample\(/);
  assert.doesNotMatch(runtimeSource, /function appendDebugLog\(/);
  assert.doesNotMatch(runtimeSource, /function resolveFlavorAssetPath\(/);
  assert.doesNotMatch(runtimeSource, /function requireTrustedMainWindowSender\(/);
  assert.match(supportSource, /function createElectronIpcSupportRuntime\(/);
  assert.match(supportSource, /require\('\.\/electronIpcAssetRuntime'\)/);
  assert.match(supportSource, /require\('\.\/electronIpcPerfRuntime'\)/);
  assert.match(supportSource, /function requireTrustedMainWindowSender\(/);
  assert.match(assetSource, /function createElectronIpcAssetRuntime\(/);
  assert.match(assetSource, /function resolveFlavorAssetPath\(/);
  assert.match(perfSource, /function createElectronIpcPerfRuntime\(/);
  assert.match(perfSource, /function recordPerfSample\(/);
});
