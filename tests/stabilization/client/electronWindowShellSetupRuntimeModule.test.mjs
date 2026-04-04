import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron window shell setup runtime owns second-instance and ready-shell integrations', async () => {
  const shellRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowShellRuntime.js', import.meta.url),
    'utf8'
  );
  const setupRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowShellSetupRuntime.js', import.meta.url),
    'utf8'
  );
  const readyRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowReadyShellRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(shellRuntimeSource, /require\('\.\/electronWindowShellSetupRuntime'\)/);
  assert.doesNotMatch(shellRuntimeSource, /function handleSecondInstance\(/);
  assert.doesNotMatch(shellRuntimeSource, /function installApplicationMenu\(/);
  assert.doesNotMatch(shellRuntimeSource, /function setupReadyShell\(/);
  assert.match(setupRuntimeSource, /function handleSecondInstance\(/);
  assert.match(setupRuntimeSource, /function installApplicationMenu\(/);
  assert.match(setupRuntimeSource, /require\('\.\/electronWindowReadyShellRuntime'\)/);
  assert.doesNotMatch(setupRuntimeSource, /function setupReadyShell\(/);
  assert.match(readyRuntimeSource, /function setupReadyShell\(/);
});
