import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron update runtime delegates download and archive extraction helpers to the shared download runtime', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/electron/updateRuntime.js', import.meta.url),
    'utf8'
  );
  const downloadRuntimeSource = await readFile(
    new URL('../../../client/electron/updateDownloadRuntime.js', import.meta.url),
    'utf8'
  );
  const downloadModelSource = await readFile(
    new URL('../../../client/electron/updateDownloadModel.js', import.meta.url),
    'utf8'
  );
  const extractRuntimeSource = await readFile(
    new URL('../../../client/electron/updateExtractRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /require\('\.\/updateDownloadRuntime'\)/);
  assert.doesNotMatch(runtimeSource, /function resolveUpdateArchiveUrl\(/);
  assert.doesNotMatch(runtimeSource, /async function downloadUpdate\(/);
  assert.doesNotMatch(runtimeSource, /async function extractUpdateArchive\(/);
  assert.match(downloadRuntimeSource, /require\('\.\/updateDownloadModel'\)/);
  assert.match(downloadRuntimeSource, /require\('\.\/updateExtractRuntime'\)/);
  assert.doesNotMatch(downloadRuntimeSource, /function resolveUpdateArchiveUrl\(/);
  assert.doesNotMatch(downloadRuntimeSource, /function waitForSpawnClose\(/);
  assert.doesNotMatch(downloadRuntimeSource, /async function extractUpdateArchive\(/);
  assert.match(downloadRuntimeSource, /function createUpdateDownloadRuntime\(/);
  assert.match(downloadRuntimeSource, /async function downloadUpdate\(/);
  assert.match(downloadModelSource, /function resolveUpdateArchiveUrl\(/);
  assert.match(extractRuntimeSource, /function waitForSpawnClose\(/);
  assert.match(extractRuntimeSource, /function createUpdateExtractRuntime\(/);
});
