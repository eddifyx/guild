import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron window content runtime owns main-window content loading and webContents wiring', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronWindowRuntime.js', import.meta.url),
    'utf8'
  );
  const contentSource = await readFile(
    new URL('../../../client/electron/electronWindowContentRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronWindowContentRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /before-input-event/);
  assert.doesNotMatch(runtimeSource, /console-message/);
  assert.doesNotMatch(runtimeSource, /context-menu/);
  assert.doesNotMatch(runtimeSource, /setWindowOpenHandler/);
  assert.doesNotMatch(runtimeSource, /system-context-menu/);
  assert.match(contentSource, /function createElectronWindowContentRuntime\(/);
  assert.match(contentSource, /before-input-event/);
  assert.match(contentSource, /console-message/);
  assert.match(contentSource, /context-menu/);
  assert.match(contentSource, /setWindowOpenHandler/);
  assert.match(contentSource, /system-context-menu/);
});
