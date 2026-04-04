import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron desktop source query runtime delegates mac prefetch ownership to the dedicated prefetch runtime', async () => {
  const querySource = await readFile(
    new URL('../../../client/electron/desktopSourceQueryRuntime.js', import.meta.url),
    'utf8'
  );
  const prefetchSource = await readFile(
    new URL('../../../client/electron/desktopSourcePrefetchRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(querySource, /require\('\.\/desktopSourcePrefetchRuntime'\)/);
  assert.doesNotMatch(querySource, /async function prefetchDesktopSources\(/);
  assert.match(prefetchSource, /async function prefetchDesktopSources\(/);
});
