import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron desktop source runtime delegates cache and serialization helpers to the shared desktop source model', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/desktopSourceRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/desktopSourceModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/desktopSourceModel'\)/);
  assert.doesNotMatch(runtimeSource, /function createEmptyDesktopSourceCache\(/);
  assert.doesNotMatch(runtimeSource, /function nativeImageToDataUrl\(/);
  assert.doesNotMatch(runtimeSource, /function serializeDesktopSource\(/);
  assert.doesNotMatch(runtimeSource, /function buildDesktopSourceThumbnails\(/);
  assert.doesNotMatch(runtimeSource, /function assignDesktopSourceCache\(/);
  assert.match(modelSource, /function createEmptyDesktopSourceCache\(/);
  assert.match(modelSource, /function nativeImageToDataUrl\(/);
  assert.match(modelSource, /function serializeDesktopSource\(/);
  assert.match(modelSource, /function buildDesktopSourceThumbnails\(/);
  assert.match(modelSource, /function assignDesktopSourceCache\(/);
});
