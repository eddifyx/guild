import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron window ready shell runtime owns ready-shell integration wiring', async () => {
  const setupRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowShellSetupRuntime.js', import.meta.url),
    'utf8'
  );
  const readyRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowReadyShellRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(setupRuntimeSource, /require\('\.\/electronWindowReadyShellRuntime'\)/);
  assert.doesNotMatch(setupRuntimeSource, /function setupReadyShell\(/);
  assert.match(readyRuntimeSource, /function createElectronWindowReadyShellRuntime\(/);
  assert.match(readyRuntimeSource, /function setupReadyShell\(/);
});
