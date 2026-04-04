import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron update download runtime delegates pure archive-url ownership to the dedicated model', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/updateDownloadRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/updateDownloadModel.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/updateDownloadModel'\)/);
  assert.doesNotMatch(runtimeSource, /function buildUpdatePlatformSlug\(/);
  assert.doesNotMatch(runtimeSource, /function resolveUpdateArchiveUrl\(/);
  assert.match(modelSource, /function buildUpdatePlatformSlug\(/);
  assert.match(modelSource, /function resolveUpdateArchiveUrl\(/);
});
