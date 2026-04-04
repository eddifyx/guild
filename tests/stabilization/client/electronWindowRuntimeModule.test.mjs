import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates window creation to the window runtime and shell lifecycle to the shared lifecycle runtime', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronWindowRuntime.js', import.meta.url),
    'utf8'
  );
  const contentRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowContentRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/electronWindowModel.js', import.meta.url),
    'utf8'
  );
  const shellRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowShellRuntime.js', import.meta.url),
    'utf8'
  );
  const shellSetupRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowShellSetupRuntime.js', import.meta.url),
    'utf8'
  );
  const readyShellRuntimeSource = await readFile(
    new URL('../../../client/electron/electronWindowReadyShellRuntime.js', import.meta.url),
    'utf8'
  );
  const menuBuilderSource = await readFile(
    new URL('../../../client/electron/electronWindowMenuBuilders.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/electronWindowRuntime'\)/);
  assert.match(mainSource, /require\('\.\/electronAppLifecycleRuntime'\)/);
  assert.match(mainSource, /createElectronWindowRuntime\(/);
  assert.match(mainSource, /createElectronAppLifecycleRuntime\(/);
  assert.doesNotMatch(mainSource, /installApplicationMenu\(\)/);
  assert.doesNotMatch(mainSource, /setupReadyShell\(\)/);
  assert.doesNotMatch(mainSource, /function showAboutDialog\(/);
  assert.doesNotMatch(mainSource, /function focusMainWindow\(/);
  assert.doesNotMatch(mainSource, /const createWindow = \(\) =>/);
  assert.match(runtimeSource, /require\('\.\/electronWindowShellRuntime'\)/);
  assert.match(runtimeSource, /require\('\.\/electronWindowContentRuntime'\)/);
  assert.match(runtimeSource, /require\('\.\/electronWindowMenuBuilders'\)/);
  assert.match(runtimeSource, /require\('\.\/electronWindowModel'\)/);
  assert.match(runtimeSource, /function createElectronWindowRuntime\(/);
  assert.doesNotMatch(runtimeSource, /function buildWindowRuntimeQuery\(/);
  assert.doesNotMatch(runtimeSource, /function buildBrowserWindowOptions\(/);
  assert.doesNotMatch(runtimeSource, /function showAboutDialog\(/);
  assert.doesNotMatch(runtimeSource, /function focusMainWindow\(/);
  assert.doesNotMatch(runtimeSource, /function installApplicationMenu\(/);
  assert.doesNotMatch(runtimeSource, /function handleSecondInstance\(/);
  assert.doesNotMatch(runtimeSource, /function setupReadyShell\(/);
  assert.doesNotMatch(runtimeSource, /function buildMacApplicationMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildTrayMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /before-input-event/);
  assert.doesNotMatch(runtimeSource, /console-message/);
  assert.doesNotMatch(runtimeSource, /setWindowOpenHandler/);
  assert.match(shellRuntimeSource, /function createElectronWindowShellRuntime\(/);
  assert.match(shellRuntimeSource, /require\('\.\/electronWindowShellSetupRuntime'\)/);
  assert.match(shellRuntimeSource, /function showAboutDialog\(/);
  assert.doesNotMatch(shellRuntimeSource, /function installApplicationMenu\(/);
  assert.doesNotMatch(shellRuntimeSource, /function handleSecondInstance\(/);
  assert.doesNotMatch(shellRuntimeSource, /function setupReadyShell\(/);
  assert.match(shellSetupRuntimeSource, /function createElectronWindowShellSetupRuntime\(/);
  assert.match(shellSetupRuntimeSource, /function installApplicationMenu\(/);
  assert.match(shellSetupRuntimeSource, /function handleSecondInstance\(/);
  assert.match(shellSetupRuntimeSource, /require\('\.\/electronWindowReadyShellRuntime'\)/);
  assert.doesNotMatch(shellSetupRuntimeSource, /function setupReadyShell\(/);
  assert.match(readyShellRuntimeSource, /function createElectronWindowReadyShellRuntime\(/);
  assert.match(readyShellRuntimeSource, /function setupReadyShell\(/);
  assert.match(contentRuntimeSource, /function createElectronWindowContentRuntime\(/);
  assert.match(contentRuntimeSource, /before-input-event/);
  assert.match(contentRuntimeSource, /setWindowOpenHandler/);
  assert.match(modelSource, /function buildWindowRuntimeQuery\(/);
  assert.match(modelSource, /function buildBrowserWindowOptions\(/);
  assert.match(modelSource, /function getProfileWindowOffset\(/);
  assert.match(runtimeSource, /profileId,/);
  assert.match(menuBuilderSource, /function buildMacApplicationMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildTrayMenuTemplate\(/);
});
