import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron startup module loader owns app-flavor and signal-bridge lookup helpers', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronStartupRuntime.js', import.meta.url),
    'utf8'
  );
  const loaderSource = await readFile(
    new URL('../../../client/electron/electronStartupModuleLoader.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronStartupModuleLoader'\)/);
  assert.doesNotMatch(runtimeSource, /function requireFirstExistingModule\(/);
  assert.doesNotMatch(runtimeSource, /function loadAppFlavorConfig\(/);
  assert.doesNotMatch(runtimeSource, /function loadSignalBridge\(/);
  assert.match(loaderSource, /function requireFirstExistingModule\(/);
  assert.match(loaderSource, /function loadAppFlavorConfig\(/);
  assert.match(loaderSource, /function loadSignalBridge\(/);
});
