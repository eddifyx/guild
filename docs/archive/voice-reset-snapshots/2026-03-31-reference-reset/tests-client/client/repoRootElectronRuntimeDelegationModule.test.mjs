import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('repo root electron main delegates apple voice, desktop source, update, and ipc utility behavior to shared runtimes', async () => {
  const mainSource = await readFile(
    new URL('../../../main.js', import.meta.url),
    'utf8'
  );
  const desktopRuntimeSource = await readFile(
    new URL('../../../client/electron/desktopSourceRuntime.js', import.meta.url),
    'utf8'
  );
  const desktopSelectionRuntimeSource = await readFile(
    new URL('../../../client/electron/desktopSourceSelectionRuntime.js', import.meta.url),
    'utf8'
  );
  const updateRuntimeSource = await readFile(
    new URL('../../../client/electron/updateRuntime.js', import.meta.url),
    'utf8'
  );
  const appleVoiceRuntimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceCaptureRuntime.js', import.meta.url),
    'utf8'
  );
  const helperRuntimeSource = await readFile(
    new URL('../../../client/electron/appleVoiceHelperRuntime.js', import.meta.url),
    'utf8'
  );
  const lifecycleRuntimeSource = await readFile(
    new URL('../../../client/electron/electronAppLifecycleRuntime.js', import.meta.url),
    'utf8'
  );
  const ipcRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRuntime.js', import.meta.url),
    'utf8'
  );
  const ipcRegistrationRuntimeSource = await readFile(
    new URL('../../../client/electron/electronIpcRegistrationRuntime.js', import.meta.url),
    'utf8'
  );

  assert.match(mainSource, /require\('\.\/client\/electron\/appleVoiceCaptureRuntime'\)/);
  assert.match(mainSource, /require\('\.\/client\/electron\/appleVoiceHelperRuntime'\)/);
  assert.match(mainSource, /require\('\.\/client\/electron\/desktopSourceRuntime'\)/);
  assert.match(mainSource, /require\('\.\/client\/electron\/electronAppLifecycleRuntime'\)/);
  assert.match(mainSource, /require\('\.\/client\/electron\/electronIpcRuntime'\)/);
  assert.match(mainSource, /require\('\.\/client\/electron\/updateRuntime'\)/);
  assert.match(mainSource, /createAppleVoiceCaptureRuntime\(/);
  assert.match(mainSource, /createAppleVoiceHelperRuntime\(/);
  assert.match(mainSource, /createElectronAppLifecycleRuntime\(/);
  assert.match(mainSource, /createElectronIpcRuntime\(/);
  assert.match(mainSource, /createUpdateRuntime\(/);
  assert.match(mainSource, /registerIpcHandlers\(/);
  assert.match(mainSource, /enforceTrustedMainWindowSender: false/);
  assert.match(mainSource, /prefetchDesktopSources,/);
  assert.match(mainSource, /getDesktopSources,/);
  assert.match(mainSource, /getDesktopWindows,/);
  assert.match(mainSource, /getDesktopThumbnails,/);
  assert.match(mainSource, /openScreenCaptureSettings,/);
  assert.match(mainSource, /updateRuntime,/);
  assert.match(mainSource, /additionalBeforeQuitHandlers: \[/);
  assert.doesNotMatch(mainSource, /function registerDisplayMediaHandler\(/);
  assert.doesNotMatch(mainSource, /function resolveUpdateArchiveUrl\(/);
  assert.doesNotMatch(mainSource, /function buildUpdateRelaunchArgs\(/);
  assert.doesNotMatch(mainSource, /function ensureAppleVoiceHelperBinary\(/);
  assert.doesNotMatch(mainSource, /function appendDebugLog\(/);
  assert.doesNotMatch(mainSource, /function resolveFlavorAssetPath\(/);
  assert.doesNotMatch(mainSource, /function openExternalHttpUrl\(/);
  assert.doesNotMatch(mainSource, /registerDisplayMediaHandler\(session\.defaultSession, \{/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\('window-minimize'/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\('download-update'/);
  assert.doesNotMatch(mainSource, /ipcMain\.handle\('room-snapshot:get'/);
  assert.match(desktopRuntimeSource, /require\('\.\/desktopSourceSelectionRuntime'\)/);
  assert.doesNotMatch(desktopRuntimeSource, /function registerDisplayMediaHandler\(/);
  assert.match(desktopSelectionRuntimeSource, /function registerDisplayMediaHandler\(/);
  assert.match(desktopSelectionRuntimeSource, /function selectDesktopSource\(/);
  assert.match(updateRuntimeSource, /function createUpdateRuntime\(/);
  assert.match(appleVoiceRuntimeSource, /function createAppleVoiceCaptureRuntime\(/);
  assert.match(helperRuntimeSource, /function createAppleVoiceHelperRuntime\(/);
  assert.match(lifecycleRuntimeSource, /function createElectronAppLifecycleRuntime\(/);
  assert.match(lifecycleRuntimeSource, /function buildDisplayMediaHandlerOptions\(/);
  assert.match(ipcRuntimeSource, /function createElectronIpcRuntime\(/);
  assert.match(ipcRuntimeSource, /require\('\.\/electronIpcRegistrationRuntime'\)/);
  assert.match(ipcRegistrationRuntimeSource, /function createElectronIpcRegistrationRuntime\(/);
  assert.match(ipcRegistrationRuntimeSource, /function registerIpcHandlers\(/);
});
