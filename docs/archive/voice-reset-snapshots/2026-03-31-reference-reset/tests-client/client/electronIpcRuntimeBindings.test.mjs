import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildAppControlIpcOptions,
  buildCaptureIpcOptions,
  buildPersistedStateIpcOptions,
  buildSystemIpcOptions,
  createTrustedSenderGuard,
} = require('../../../client/electron/electronIpcRuntimeBindings.js');

test('electron IPC runtime bindings preserve trusted-sender gating semantics', () => {
  const calls = [];
  const guard = createTrustedSenderGuard({
    enforceTrustedMainWindowSender: true,
    getMainWindow: () => 'window',
    requireTrustedMainWindowSender(event, scope, getMainWindow) {
      calls.push([event, scope, getMainWindow()]);
    },
  });
  const relaxedGuard = createTrustedSenderGuard({
    enforceTrustedMainWindowSender: false,
    getMainWindow: () => 'window',
    requireTrustedMainWindowSender() {
      calls.push(['blocked']);
    },
  });

  guard('event-a', 'scope-a');
  relaxedGuard('event-b', 'scope-b');

  assert.deepEqual(calls, [['event-a', 'scope-a', 'window']]);
});

test('electron IPC runtime bindings build canonical registration bags for child IPC owners', () => {
  const requireTrustedSender = () => {};
  const getMainWindow = () => 'main-window';
  const appOptions = buildAppControlIpcOptions({
    app: 'app',
    appFlavorId: 'staging',
    appVersion: '1.2.3',
    getMainWindow,
    ipcMain: 'ipc-main',
    logger: 'logger',
  });
  const captureOptions = buildCaptureIpcOptions({
    appendDebugLog: 'append-log',
    desktopCapturer: 'desktop-capturer',
    getDesktopSourceCache: 'cache',
    getDesktopSources: 'sources',
    getDesktopThumbnails: 'thumbs',
    getDesktopWindows: 'windows',
    getScreenCaptureAccessStatus: 'access',
    ipcMain: 'ipc-main',
    isAppleVoiceCaptureSupported: 'apple-supported',
    openExternal: 'open-external',
    openScreenCaptureSettings: 'open-settings',
    platform: 'darwin',
    prefetchDesktopSources: 'prefetch',
    primeAppleVoiceCapture: 'prime',
    requireTrustedSender,
    selectDesktopSource: 'select-source',
    setDesktopSourceCache: 'set-cache',
    setPendingSourceId: 'set-pending',
    startAppleVoiceCaptureSession: 'start-session',
    stopAppleVoiceCaptureSession: 'stop-session',
    systemPreferences: 'system-preferences',
  });
  const persistedStateOptions = buildPersistedStateIpcOptions({
    clearAuthBackup: 'clear-auth',
    deleteMessageCacheEntry: 'delete-cache',
    getMessageCacheEntry: 'get-cache',
    getManyMessageCacheEntries: 'get-many',
    getRoomSnapshotEntry: 'get-room',
    ipcMain: 'ipc-main',
    logger: 'logger',
    readAuthBackup: 'read-auth',
    requireTrustedSender,
    setMessageCacheEntry: 'set-cache',
    setRoomSnapshotEntry: 'set-room',
    writeAuthBackup: 'write-auth',
  });
  const systemOptions = buildSystemIpcOptions({
    Notification: 'notification',
    appendDebugLog: 'append-log',
    focusMainWindow: 'focus-window',
    getMainWindow,
    getPerfSamples: 'get-perf',
    ipcMain: 'ipc-main',
    openExternalHttpUrl: 'open-http',
    recordPerfSample: 'record-perf',
    requireTrustedSender,
    resolveFlavorAssetPath: 'resolve-asset',
    updateRuntime: 'update-runtime',
  });

  assert.deepEqual(appOptions, {
    app: 'app',
    appFlavorId: 'staging',
    appVersion: '1.2.3',
    getMainWindow,
    ipcMain: 'ipc-main',
    logger: 'logger',
  });
  assert.equal(captureOptions.requireTrustedSender, requireTrustedSender);
  assert.equal(captureOptions.openExternal, 'open-external');
  assert.equal(captureOptions.setPendingSourceId, 'set-pending');
  assert.equal(persistedStateOptions.getManyMessageCacheEntries, 'get-many');
  assert.equal(persistedStateOptions.writeAuthBackup, 'write-auth');
  assert.equal(systemOptions.getMainWindow, getMainWindow);
  assert.equal(systemOptions.updateRuntime, 'update-runtime');
});
