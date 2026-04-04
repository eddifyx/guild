import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('electron main delegates desktop source and screen-capture helpers to the shared runtime module', async () => {
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
  const captureIpcSource = await readFile(
    new URL('../../../client/electron/electronCaptureIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const helperSource = await readFile(
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
  const selectionSource = await readFile(
    new URL('../../../client/electron/desktopSourceSelectionRuntime.js', import.meta.url),
    'utf8'
  );
  const modelSource = await readFile(
    new URL('../../../client/electron/desktopSourceModel.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/desktopSourceRuntime'\)/);
  assert.match(mainSource, /require\('\.\/electronIpcRuntime'\)/);
  assert.match(mainSource, /registerIpcHandlers\(/);
  assert.match(mainSource, /prefetchDesktopSources,/);
  assert.match(mainSource, /getDesktopSources,/);
  assert.match(mainSource, /getDesktopWindows,/);
  assert.match(mainSource, /getDesktopThumbnails,/);
  assert.match(mainSource, /selectDesktopSource,/);
  assert.match(mainSource, /getScreenCaptureAccessStatus,/);
  assert.match(mainSource, /openScreenCaptureSettings,/);
  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(registrationRuntimeSource, /require\('\.\/electronCaptureIpcRuntime'\)/);
  assert.match(registrationRuntimeSource, /registerCaptureIpcHandlers\(/);
  assert.match(captureIpcSource, /ipcMain\.handle\('prefetch-desktop-sources'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('get-desktop-sources'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('get-desktop-windows'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('get-desktop-thumbnails'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('select-desktop-source'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('get-screen-capture-access-status'/);
  assert.match(captureIpcSource, /ipcMain\.handle\('open-screen-capture-settings'/);
  assert.match(helperSource, /require\('\.\/desktopSourceQueryRuntime'\)/);
  assert.match(helperSource, /require\('\.\/desktopSourceSelectionRuntime'\)/);
  assert.doesNotMatch(helperSource, /async function prefetchDesktopSources\(/);
  assert.doesNotMatch(helperSource, /async function getDesktopSources\(/);
  assert.doesNotMatch(helperSource, /async function getDesktopWindows\(/);
  assert.doesNotMatch(helperSource, /async function getDesktopThumbnails\(/);
  assert.match(querySource, /require\('\.\/desktopSourcePrefetchRuntime'\)/);
  assert.doesNotMatch(querySource, /async function prefetchDesktopSources\(/);
  assert.match(querySource, /async function getDesktopSources\(/);
  assert.match(querySource, /async function getDesktopWindows\(/);
  assert.match(querySource, /async function getDesktopThumbnails\(/);
  assert.match(prefetchSource, /async function prefetchDesktopSources\(/);
  assert.match(selectionSource, /async function handleDisplayMediaRequest\(/);
  assert.match(selectionSource, /function registerDisplayMediaHandler\(/);
  assert.match(selectionSource, /function selectDesktopSource\(/);
  assert.match(modelSource, /function createEmptyDesktopSourceCache\(/);
});
