import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron desktop source runtime delegates query and cache helpers to the shared query runtime module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/desktopSourceRuntime.js', import.meta.url),
    'utf8'
  );
  const querySource = await readFile(
    new URL('../../../client/electron/desktopSourceQueryRuntime.js', import.meta.url),
    'utf8'
  );
  const prefetchSource = await readFile(
    new URL('../../../client/electron/desktopSourcePrefetchRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/desktopSourceQueryRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /async function prefetchDesktopSources\(/);
  assert.doesNotMatch(runtimeSource, /async function getDesktopSources\(/);
  assert.doesNotMatch(runtimeSource, /async function getDesktopWindows\(/);
  assert.doesNotMatch(runtimeSource, /async function getDesktopThumbnails\(/);
  assert.match(querySource, /require\('\.\/desktopSourcePrefetchRuntime'\)/);
  assert.doesNotMatch(querySource, /async function prefetchDesktopSources\(/);
  assert.match(querySource, /async function getDesktopSources\(/);
  assert.match(querySource, /async function getDesktopWindows\(/);
  assert.match(querySource, /async function getDesktopThumbnails\(/);
  assert.match(prefetchSource, /async function prefetchDesktopSources\(/);
});
