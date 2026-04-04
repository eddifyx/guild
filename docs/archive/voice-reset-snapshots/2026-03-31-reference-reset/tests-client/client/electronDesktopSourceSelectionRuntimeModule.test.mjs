import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron desktop source runtime delegates display-media selection helpers to the dedicated selection runtime', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/desktopSourceRuntime.js', import.meta.url),
    'utf8'
  );
  const selectionSource = await readFile(
    new URL('../../../client/electron/desktopSourceSelectionRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/desktopSourceSelectionRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /async function handleDisplayMediaRequest\(/);
  assert.doesNotMatch(runtimeSource, /function registerDisplayMediaHandler\(/);
  assert.doesNotMatch(runtimeSource, /function selectDesktopSource\(/);
  assert.match(selectionSource, /async function handleDisplayMediaRequest\(/);
  assert.match(selectionSource, /function registerDisplayMediaHandler\(/);
  assert.match(selectionSource, /function selectDesktopSource\(/);
});
