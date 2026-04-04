import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('both Electron entry files delegate startup flavor, profile, and bridge boot logic to the shared startup runtime', async () => {
  const repoRootMainSource = await readFile(
    new URL('../../../main.js', import.meta.url),
    'utf8'
  );
  const electronMainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronStartupRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/electronStartupModel.js', import.meta.url),
    'utf8'
  );
  const loaderSource = await readFile(
    new URL('../../../client/electron/electronStartupModuleLoader.js', import.meta.url),
    'utf8'
  );
  const profileSource = await readFile(
    new URL('../../../client/electron/electronStartupProfileRuntime.js', import.meta.url),
    'utf8'
  );
  const appSettingsSource = await readFile(
    new URL('../../../client/electron/electronStartupAppSettingsRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(repoRootMainSource, /require\('\.\/client\/electron\/electronStartupRuntime'\)/);
  assert.match(electronMainSource, /require\('\.\/electronStartupRuntime'\)/);
  assert.match(repoRootMainSource, /createElectronStartupRuntime\(/);
  assert.match(electronMainSource, /createElectronStartupRuntime\(/);
  assert.doesNotMatch(repoRootMainSource, /function loadAppFlavorConfig\(/);
  assert.doesNotMatch(repoRootMainSource, /function sanitizeProfileId\(/);
  assert.doesNotMatch(repoRootMainSource, /function getRuntimeProfile\(/);
  assert.doesNotMatch(repoRootMainSource, /function getRuntimeServerUrl\(/);
  assert.doesNotMatch(repoRootMainSource, /function detectRuntimeAppFlavor\(/);
  assert.doesNotMatch(repoRootMainSource, /function loadSignalBridge\(/);
  assert.doesNotMatch(electronMainSource, /function loadAppFlavorConfig\(/);
  assert.doesNotMatch(electronMainSource, /function sanitizeProfileId\(/);
  assert.doesNotMatch(electronMainSource, /function getRuntimeProfile\(/);
  assert.doesNotMatch(electronMainSource, /function getRuntimeServerUrl\(/);
  assert.doesNotMatch(electronMainSource, /function detectRuntimeAppFlavor\(/);
  assert.doesNotMatch(electronMainSource, /function loadSignalBridge\(/);
  assert.match(runtimeSource, /function createElectronStartupRuntime\(/);
  assert.match(runtimeSource, /require\('\.\/electronStartupModel'\)/);
  assert.match(runtimeSource, /require\('\.\/electronStartupModuleLoader'\)/);
  assert.match(runtimeSource, /require\('\.\/electronStartupProfileRuntime'\)/);
  assert.match(runtimeSource, /require\('\.\/electronStartupAppSettingsRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function configureProfilePaths\(/);
  assert.doesNotMatch(runtimeSource, /function applyBaseElectronAppSettings\(/);
  assert.match(modelSource, /function detectRuntimeAppFlavor\(/);
  assert.match(loaderSource, /function loadSignalBridge\(/);
  assert.match(loaderSource, /path\.join\(baseDir, 'client', 'electron', 'crypto', 'signalBridge\.js'\)/);
  assert.match(profileSource, /function configureProfilePaths\(/);
  assert.match(appSettingsSource, /function applyBaseElectronAppSettings\(/);
});
