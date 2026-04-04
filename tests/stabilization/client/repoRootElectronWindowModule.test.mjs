import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('repo root electron main delegates window creation to the shared window runtime and shell lifecycle to the lifecycle runtime', async () => {
  const mainSource = await readFile(
    new URL('../../../main.js', import.meta.url),
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
  const menuBuilderSource = await readFile(
    new URL('../../../client/electron/electronWindowMenuBuilders.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/client\/electron\/electronWindowRuntime'\)/);
  assert.match(mainSource, /require\('\.\/client\/electron\/electronAppLifecycleRuntime'\)/);
  assert.match(mainSource, /createElectronWindowRuntime\(/);
  assert.match(mainSource, /createElectronAppLifecycleRuntime\(/);
  assert.match(mainSource, /enableNavigationGuards: false/);
  assert.doesNotMatch(mainSource, /installApplicationMenu\(\)/);
  assert.doesNotMatch(mainSource, /setupReadyShell\(\)/);
  assert.doesNotMatch(mainSource, /handleSecondInstance\(commandLine\)/);
  assert.doesNotMatch(mainSource, /function focusMainWindow\(/);
  assert.doesNotMatch(mainSource, /const createWindow = \(\) =>/);
  assert.doesNotMatch(mainSource, /function showAboutDialog\(/);
  assert.doesNotMatch(mainSource, /Menu\.setApplicationMenu\(Menu\.buildFromTemplate/);
  assert.match(runtimeSource, /require\('\.\/electronWindowMenuBuilders'\)/);
  assert.match(runtimeSource, /require\('\.\/electronWindowModel'\)/);
  assert.match(runtimeSource, /require\('\.\/electronWindowContentRuntime'\)/);
  assert.match(runtimeSource, /function createElectronWindowRuntime\(/);
  assert.doesNotMatch(runtimeSource, /function buildWindowRuntimeQuery\(/);
  assert.doesNotMatch(runtimeSource, /function buildBrowserWindowOptions\(/);
  assert.doesNotMatch(runtimeSource, /function buildMacApplicationMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildTrayMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /before-input-event/);
  assert.match(contentRuntimeSource, /function createElectronWindowContentRuntime\(/);
  assert.match(contentRuntimeSource, /before-input-event/);
  assert.match(modelSource, /function buildWindowRuntimeQuery\(/);
  assert.match(modelSource, /function buildBrowserWindowOptions\(/);
  assert.match(menuBuilderSource, /function buildMacApplicationMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildTrayMenuTemplate\(/);
});
