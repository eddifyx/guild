import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates native update download and apply helpers to the shared update runtime', async () => {
  const mainSource = await readFile(
    new URL('../../../client/electron/main.js', import.meta.url),
    'utf8'
  );
  const ipcRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const registrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );
  const systemIpcSource = await readFile(
    new URL('../../../client/electron/electronSystemIpcRuntime.js', import.meta.url),
    'utf8'
  );
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
  const applyRuntimeSource = await readFile(
    new URL('../../../client/electron/updateApplyRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/updateRuntime'\)/);
  assert.match(mainSource, /require\('\.\/electronIpcRuntime'\)/);
  assert.match(mainSource, /createUpdateRuntime\(/);
  assert.match(mainSource, /registerIpcHandlers\(/);
  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronSystemIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerSystemIpcHandlers\(/);
  assert.match(systemIpcSource, /updateRuntime\.downloadUpdate\(/);
  assert.match(systemIpcSource, /updateRuntime\.applyUpdate\(/);
  assert.doesNotMatch(mainSource, /function resolveUpdateArchiveUrl\(/);
  assert.doesNotMatch(mainSource, /function buildUpdateRelaunchArgs\(/);
  assert.match(runtimeSource, /function createUpdateRuntime\(/);
  assert.match(runtimeSource, /function buildUpdateRelaunchArgs\(/);
  assert.match(runtimeSource, /require\('\.\/updateDownloadRuntime'\)/);
  assert.match(runtimeSource, /require\('\.\/updateApplyRuntime'\)/);
  assert.match(downloadRuntimeSource, /require\('\.\/updateDownloadModel'\)/);
  assert.match(downloadRuntimeSource, /require\('\.\/updateExtractRuntime'\)/);
  assert.doesNotMatch(downloadRuntimeSource, /function resolveUpdateArchiveUrl\(/);
  assert.match(downloadRuntimeSource, /function createUpdateDownloadRuntime\(/);
  assert.match(downloadModelSource, /function resolveUpdateArchiveUrl\(/);
  assert.match(extractRuntimeSource, /function createUpdateExtractRuntime\(/);
  assert.match(applyRuntimeSource, /function applyExtractedUpdate\(/);
});
