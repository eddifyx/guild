import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronIpcRegistrationRuntime,
} = require('../../../client/electron/electronIpcRegistrationRuntime.js');

function createIpcMainStub() {
  const handles = new Map();
  const handlers = new Map();
  return {
    handle(channel, fn) {
      handles.set(channel, fn);
    },
    on(channel, fn) {
      handlers.set(channel, fn);
    },
    __handles: handles,
    __handlers: handlers,
  };
}

function createNotificationStub() {
  return class NotificationStub {
    static isSupported() {
      return true;
    }

    constructor() {
      this.handlers = new Map();
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    show() {}
  };
}

test('electron IPC registration runtime wires child IPC owners through the shared support contract', async () => {
  const warnings = [];
  const perfSamples = [];
  const ipcMain = createIpcMainStub();
  const mainWindow = {
    minimized: false,
    webContents: {
      send() {},
    },
    minimize() {
      this.minimized = true;
    },
    isMaximized() {
      return false;
    },
    maximize() {},
    close() {},
  };
  const registrationRuntime = createElectronIpcRegistrationRuntime({
    Notification: createNotificationStub(),
    appVersion: '1.2.3',
    logger: {
      warn(...args) {
        warnings.push(args);
      },
    },
    openExternal() {},
    supportRuntime: {
      appendDebugLog() {},
      getPerfSamples() {
        return perfSamples;
      },
      openExternalHttpUrl() {
        return true;
      },
      recordPerfSample(sample) {
        perfSamples.push(sample);
      },
      requireTrustedMainWindowSender(event, scope, getMainWindow) {
        if (event?.sender !== getMainWindow()?.webContents) {
          throw new Error(`Untrusted IPC sender for ${scope}`);
        }
      },
      resolveFlavorAssetPath() {
        return '/tmp/icon.png';
      },
    },
  });

  const cacheCalls = [];
  const updateCalls = [];
  registrationRuntime.registerIpcHandlers({
    app: {
      getGPUFeatureStatus() {
        return { webgl: 'enabled' };
      },
      isHardwareAccelerationEnabled() {
        return true;
      },
      quit() {},
      relaunch() {},
    },
    appFlavorId: 'staging',
    clearAuthBackup() {
      return true;
    },
    deleteMessageCacheEntry(userId, messageId) {
      cacheCalls.push(['delete', userId, messageId]);
      return true;
    },
    desktopCapturer: {},
    focusMainWindow() {},
    getDesktopSourceCache() {
      return null;
    },
    getDesktopSources() {
      return [];
    },
    getDesktopThumbnails() {
      return [];
    },
    getDesktopWindows() {
      return [];
    },
    getMainWindow() {
      return mainWindow;
    },
    getMessageCacheEntry(userId, messageId) {
      cacheCalls.push(['get', userId, messageId]);
      return { hit: true };
    },
    getManyMessageCacheEntries() {
      return [];
    },
    getRoomSnapshotEntry(userId, roomId) {
      cacheCalls.push(['room-get', userId, roomId]);
      return { roomId };
    },
    getPendingSourceId() {
      return null;
    },
    getScreenCaptureAccessStatus() {
      return 'granted';
    },
    ipcMain,
    isAppleVoiceCaptureSupported() {
      return true;
    },
    openScreenCaptureSettings() {
      return true;
    },
    platform: 'darwin',
    prefetchDesktopSources() {
      return [];
    },
    primeAppleVoiceCapture() {
      return true;
    },
    readAuthBackup() {
      return { token: 'abc' };
    },
    selectDesktopSource() {},
    setDesktopSourceCache() {},
    setMessageCacheEntry() {
      return true;
    },
    setRoomSnapshotEntry() {
      return true;
    },
    setPendingSourceId() {},
    startAppleVoiceCaptureSession() {
      return true;
    },
    stopAppleVoiceCaptureSession() {
      return true;
    },
    systemPreferences: {},
    updateRuntime: {
      applyUpdate(args) {
        updateCalls.push(['apply', args]);
        return true;
      },
      downloadUpdate(source) {
        updateCalls.push(['download', source]);
        return true;
      },
    },
    writeAuthBackup() {
      return true;
    },
  });

  const trustedEvent = { sender: mainWindow.webContents };
  const blockedEvent = { sender: {} };

  ipcMain.__handlers.get('perf:sample')(null, { fps: 60 });
  assert.deepEqual(ipcMain.__handles.get('perf:get-samples')(), [{ fps: 60 }]);
  assert.equal(ipcMain.__handles.get('window-minimize')(), undefined);
  assert.equal(mainWindow.minimized, true);
  assert.deepEqual(ipcMain.__handles.get('message-cache:get')(trustedEvent, 'user-1', 'msg-1'), { hit: true });
  assert.throws(() => ipcMain.__handles.get('message-cache:get')(blockedEvent, 'user-1', 'msg-1'), /Untrusted IPC sender/);
  assert.deepEqual(ipcMain.__handles.get('room-snapshot:get')(trustedEvent, 'user-1', 'room-1'), { roomId: 'room-1' });

  const authStateEvent = { sender: mainWindow.webContents };
  ipcMain.__handlers.get('auth-state:get-sync')(authStateEvent);
  assert.deepEqual(authStateEvent.returnValue, { token: 'abc' });

  const blockedAuthStateEvent = { sender: {}, returnValue: undefined };
  ipcMain.__handlers.get('auth-state:get-sync')(blockedAuthStateEvent);
  assert.equal(blockedAuthStateEvent.returnValue, null);
  assert.equal(warnings.length, 1);

  assert.equal(await ipcMain.__handles.get('download-update')(trustedEvent, 'https://updates.guild.test'), true);
  assert.deepEqual(updateCalls, [['download', 'https://updates.guild.test']]);
  assert.deepEqual(cacheCalls[0], ['get', 'user-1', 'msg-1']);
});
