import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron window runtime delegates shell integrations to the dedicated window shell runtime', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronWindowRuntime.js', import.meta.url),
    'utf8'
  );
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

  assert.match(runtimeSource, /require\('\.\/electronWindowShellRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function showAboutDialog\(/);
  assert.doesNotMatch(runtimeSource, /function focusMainWindow\(/);
  assert.doesNotMatch(runtimeSource, /function installApplicationMenu\(/);
  assert.doesNotMatch(runtimeSource, /function handleSecondInstance\(/);
  assert.doesNotMatch(runtimeSource, /function setupReadyShell\(/);
  assert.match(shellRuntimeSource, /require\('\.\/electronWindowShellSetupRuntime'\)/);
  assert.match(shellRuntimeSource, /function showAboutDialog\(/);
  assert.match(shellRuntimeSource, /function focusMainWindow\(/);
  assert.doesNotMatch(shellRuntimeSource, /function installApplicationMenu\(/);
  assert.doesNotMatch(shellRuntimeSource, /function handleSecondInstance\(/);
  assert.doesNotMatch(shellRuntimeSource, /function setupReadyShell\(/);
  assert.match(setupRuntimeSource, /function installApplicationMenu\(/);
  assert.match(setupRuntimeSource, /function handleSecondInstance\(/);
  assert.doesNotMatch(setupRuntimeSource, /function setupReadyShell\(/);
  assert.match(setupRuntimeSource, /require\('\.\/electronWindowReadyShellRuntime'\)/);
  assert.match(readyRuntimeSource, /function setupReadyShell\(/);
});
