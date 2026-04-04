import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron window runtime delegates pure menu and jump-list builders to a dedicated module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/electronWindowRuntime.js', import.meta.url),
    'utf8'
  );
  const menuBuilderSource = await readFile(
    new URL('../../../client/electron/electronWindowMenuBuilders.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/electronWindowMenuBuilders'\)/);
  assert.doesNotMatch(runtimeSource, /function buildWindowContextMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildSystemContextMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildMacApplicationMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildDockMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildTrayMenuTemplate\(/);
  assert.doesNotMatch(runtimeSource, /function buildWindowsJumpListTasks\(/);
  assert.match(menuBuilderSource, /function buildWindowContextMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildSystemContextMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildMacApplicationMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildDockMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildTrayMenuTemplate\(/);
  assert.match(menuBuilderSource, /function buildWindowsJumpListTasks\(/);
});
