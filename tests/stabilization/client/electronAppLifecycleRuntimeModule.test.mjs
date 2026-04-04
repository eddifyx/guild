import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('both Electron entry files delegate app lifecycle glue to the shared lifecycle runtime', async () => {
  const repoRootMainSource = await readFile(
    new URL('../../../main.js', import.meta.url),
    'utf8'
  );
  const electronMainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronAppLifecycleRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(repoRootMainSource, /require\('\.\/client\/electron\/electronAppLifecycleRuntime'\)/);
  assert.match(electronMainSource, /require\('\.\/electronAppLifecycleRuntime'\)/);
  assert.match(repoRootMainSource, /createElectronAppLifecycleRuntime\(/);
  assert.match(electronMainSource, /createElectronAppLifecycleRuntime\(/);
  assert.doesNotMatch(repoRootMainSource, /app\.setAboutPanelOptions\(/);
  assert.doesNotMatch(repoRootMainSource, /app\.whenReady\(\)\.then\(/);
  assert.doesNotMatch(repoRootMainSource, /app\.on\('second-instance'/);
  assert.doesNotMatch(repoRootMainSource, /app\.on\('before-quit'/);
  assert.doesNotMatch(repoRootMainSource, /app\.on\('window-all-closed'/);
  assert.doesNotMatch(repoRootMainSource, /app\.on\('activate'/);
  assert.doesNotMatch(electronMainSource, /app\.setAboutPanelOptions\(/);
  assert.doesNotMatch(electronMainSource, /app\.whenReady\(\)\.then\(/);
  assert.doesNotMatch(electronMainSource, /app\.on\('second-instance'/);
  assert.doesNotMatch(electronMainSource, /app\.on\('before-quit'/);
  assert.doesNotMatch(electronMainSource, /app\.on\('window-all-closed'/);
  assert.doesNotMatch(electronMainSource, /app\.on\('activate'/);
  assert.match(runtimeSource, /function createElectronAppLifecycleRuntime\(/);
  assert.match(runtimeSource, /function buildAboutPanelOptions\(/);
  assert.match(runtimeSource, /function buildDisplayMediaHandlerOptions\(/);
});
