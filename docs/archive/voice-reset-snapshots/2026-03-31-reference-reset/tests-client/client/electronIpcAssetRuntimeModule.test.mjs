import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron IPC support runtime delegates asset and external-url ownership to the dedicated asset runtime', async () => {
  const supportSource = await readFile(
    new URL('../../../client/electron/electronIpcSupportRuntime.js', import.meta.url),
    'utf8'
  );
  const assetSource = await readFile(
    new URL('../../../client/electron/electronIpcAssetRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(supportSource, /require\('\.\/electronIpcAssetRuntime'\)/);
  assert.doesNotMatch(supportSource, /function resolveAssetPath\(/);
  assert.doesNotMatch(supportSource, /function resolveFlavorAssetPath\(/);
  assert.doesNotMatch(supportSource, /function openExternalHttpUrl\(/);
  assert.match(assetSource, /function isSafeExternalHttpUrl\(/);
  assert.match(assetSource, /function createElectronIpcAssetRuntime\(/);
});
