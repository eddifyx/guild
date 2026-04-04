import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron update download runtime delegates archive extraction ownership to the dedicated extract runtime', async () => {
  const downloadRuntimeSource = await readFile(
    new URL('../../../client/electron/updateDownloadRuntime.js', import.meta.url),
    'utf8'
  );
  const extractRuntimeSource = await readFile(
    new URL('../../../client/electron/updateExtractRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(downloadRuntimeSource, /require\('\.\/updateExtractRuntime'\)/);
  assert.doesNotMatch(downloadRuntimeSource, /function waitForSpawnClose\(/);
  assert.doesNotMatch(downloadRuntimeSource, /async function extractUpdateArchive\(/);
  assert.match(extractRuntimeSource, /function waitForSpawnClose\(/);
  assert.match(extractRuntimeSource, /function createUpdateExtractRuntime\(/);
});
