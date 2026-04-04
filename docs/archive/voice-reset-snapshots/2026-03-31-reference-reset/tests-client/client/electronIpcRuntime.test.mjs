import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronIpcRuntime,
  isSafeExternalHttpUrl,
} = require('../../../client/electron/electronIpcRuntime.js');

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
  class NotificationStub {
    static instances = [];

    static isSupported() {
      return true;
    }

    constructor(options) {
      this.options = options;
      this.handlers = new Map();
      this.shown = false;
      NotificationStub.instances.push(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    show() {
      this.shown = true;
    }
  }

  return NotificationStub;
}

test('electron IPC runtime resolves assets, writes debug logs, and opens only safe external HTTP URLs', () => {
  const appendedLogs = [];
  const externalOpens = [];
  const infoLogs = [];
  const runtime = createElectronIpcRuntime({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    assetSuffix: 'staging',
    baseDir: '/tmp/client/electron',
    fs: {
      appendFileSync(...args) {
        appendedLogs.push(args);
      },
      existsSync(candidate) {
        return candidate.endsWith('/assets/icon-staging.png');
      },
    },
    Notification: createNotificationStub(),
    logger: {
      info(...args) {
        infoLogs.push(args);
      },
      warn() {},
    },
    openExternal(url) {
      externalOpens.push(url);
    },
    os: {
      tmpdir() {
        return '/tmp';
      },
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    productSlug: 'guild',
    processEnv: { NODE_ENV: 'development' },
  });

  runtime.appendDebugLog('debug', 'details');
  assert.equal(appendedLogs[0][0], '/tmp/guild-debug.log');
  assert.match(appendedLogs[0][1], /\[debug\] details/);

  assert.equal(runtime.resolveFlavorAssetPath('icon', 'png'), '/tmp/client/electron/../assets/icon-staging.png');
  assert.equal(runtime.openExternalHttpUrl('https://guild.test'), true);
  assert.equal(runtime.openExternalHttpUrl('javascript:alert(1)'), false);
  assert.deepEqual(externalOpens, ['https://guild.test']);
  assert.equal(isSafeExternalHttpUrl('http://guild.test'), true);
  assert.equal(isSafeExternalHttpUrl('file:///tmp/test'), false);

  const ipcMain = createIpcMainStub();
  const mainWindow = {
    webContents: {
      send() {},
    },
    isMaximized() {
      return false;
    },
    maximize() {},
    minimize() {},
    close() {},
  };

  runtime.registerIpcHandlers({
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
    clearAuthBackup() {},
    deleteMessageCacheEntry() {},
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
    getMessageCacheEntry() {},
    getManyMessageCacheEntries() {},
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
      return null;
    },
    selectDesktopSource() {},
    setDesktopSourceCache() {},
    setMessageCacheEntry() {},
    setPendingSourceId() {},
    startAppleVoiceCaptureSession() {
      return true;
    },
    stopAppleVoiceCaptureSession() {
      return true;
    },
    systemPreferences: {},
    updateRuntime: {
      applyUpdate() {},
      downloadUpdate() {},
    },
    writeAuthBackup() {},
  });

  ipcMain.__handlers.get('perf:sample')(null, { fps: 60 });
  assert.equal(infoLogs.length, 1);
  assert.equal(ipcMain.__handles.get('perf:get-samples')().length, 1);
});

test('electron IPC runtime registers trusted handlers for app, message cache, notifications, and updates', async () => {
  const warnings = [];
  const externalOpens = [];
  const notificationActions = [];
  const focusCalls = [];
  const cacheCalls = [];
  const updateCalls = [];
  const ipcMain = createIpcMainStub();
  const NotificationStub = createNotificationStub();
  const mainWindow = {
    minimized: false,
    maximized: false,
    closed: 0,
    webContents: {
      send(channel, payload) {
        notificationActions.push([channel, payload]);
      },
    },
    minimize() {
      this.minimized = true;
    },
    isMaximized() {
      return this.maximized;
    },
    maximize() {
      this.maximized = true;
    },
    unmaximize() {
      this.maximized = false;
    },
    close() {
      this.closed += 1;
    },
  };

  const runtime = createElectronIpcRuntime({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    assetSuffix: 'staging',
    baseDir: '/tmp/client/electron',
    fs: {
      appendFileSync() {},
      existsSync(candidate) {
        return candidate.endsWith('/assets/icon-staging.png');
      },
    },
    Notification: NotificationStub,
    logger: {
      info() {},
      warn(...args) {
        warnings.push(args);
      },
    },
    openExternal(url) {
      externalOpens.push(url);
    },
    os: {
      tmpdir() {
        return '/tmp';
      },
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    productSlug: 'guild',
    processEnv: { NODE_ENV: 'development' },
  });

  runtime.registerIpcHandlers({
    app: {
      getGPUFeatureStatus() {
        return { webgl: 'enabled' };
      },
      isHardwareAccelerationEnabled() {
        return true;
      },
      quit() {
        updateCalls.push(['quit']);
      },
      relaunch() {
        updateCalls.push(['relaunch']);
      },
    },
    appFlavorId: 'staging',
    clearAuthBackup() {
      return 'cleared';
    },
    deleteMessageCacheEntry(userId, messageId) {
      cacheCalls.push(['delete', userId, messageId]);
      return true;
    },
    desktopCapturer: {},
    focusMainWindow() {
      focusCalls.push('focus');
    },
    getDesktopSourceCache() {
      return { sources: [] };
    },
    getDesktopSources({ platform }) {
      return [{ platform }];
    },
    getDesktopThumbnails() {
      return ['thumb'];
    },
    getDesktopWindows() {
      return ['window'];
    },
    getMainWindow() {
      return mainWindow;
    },
    getMessageCacheEntry(userId, messageId) {
      cacheCalls.push(['get', userId, messageId]);
      return { hit: true };
    },
    getManyMessageCacheEntries(userId, messageIds) {
      cacheCalls.push(['get-many', userId, messageIds]);
      return messageIds.map((messageId) => ({ messageId }));
    },
    getRoomSnapshotEntry(userId, roomId) {
      cacheCalls.push(['room-get', userId, roomId]);
      return { roomId };
    },
    getPendingSourceId() {
      return 'screen:1';
    },
    getScreenCaptureAccessStatus() {
      return 'granted';
    },
    ipcMain,
    isAppleVoiceCaptureSupported() {
      return true;
    },
    openScreenCaptureSettings({ openExternal }) {
      openExternal('x-apple.systempreferences:screen-capture');
      return true;
    },
    platform: 'darwin',
    prefetchDesktopSources() {
      return ['prefetched'];
    },
    primeAppleVoiceCapture() {
      return 'primed';
    },
    readAuthBackup() {
      return { token: 'abc' };
    },
    selectDesktopSource(sourceId, { setPendingSourceId }) {
      setPendingSourceId(sourceId);
      return true;
    },
    setDesktopSourceCache() {},
    setMessageCacheEntry(userId, messageId, entry) {
      cacheCalls.push(['set', userId, messageId, entry]);
      return true;
    },
    setRoomSnapshotEntry(userId, roomId, snapshot) {
      cacheCalls.push(['room-set', userId, roomId, snapshot]);
      return true;
    },
    setPendingSourceId() {},
    startAppleVoiceCaptureSession(ownerId) {
      return `started:${ownerId}`;
    },
    stopAppleVoiceCaptureSession(ownerId) {
      return `stopped:${ownerId}`;
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
    writeAuthBackup(authData) {
      return authData;
    },
  });

  const trustedEvent = { sender: mainWindow.webContents };
  const untrustedEvent = { sender: {} };

  assert.equal(ipcMain.__handles.get('window-minimize')(), undefined);
  assert.equal(mainWindow.minimized, true);
  assert.equal(ipcMain.__handles.get('window-maximize')(), undefined);
  assert.equal(mainWindow.maximized, true);
  assert.equal(ipcMain.__handles.get('get-app-version')(), '1.2.3');

  const flavorEvent = {};
  ipcMain.__handlers.get('get-app-flavor-sync')(flavorEvent);
  assert.equal(flavorEvent.returnValue, 'staging');

  assert.equal(await ipcMain.__handles.get('apple-voice-capture-start')(null, 'owner-1'), 'started:owner-1');
  assert.deepEqual(await ipcMain.__handles.get('prefetch-desktop-sources')(), ['prefetched']);
  assert.deepEqual(await ipcMain.__handles.get('get-desktop-sources')(), [{ platform: 'darwin' }]);

  assert.deepEqual(ipcMain.__handles.get('message-cache:get')(trustedEvent, 'user-1', 'msg-1'), { hit: true });
  assert.throws(() => ipcMain.__handles.get('message-cache:get')(untrustedEvent, 'user-1', 'msg-1'), /Untrusted IPC sender/);
  assert.deepEqual(ipcMain.__handles.get('room-snapshot:get')(trustedEvent, 'user-1', 'room-1'), { roomId: 'room-1' });
  assert.throws(() => ipcMain.__handles.get('room-snapshot:get')(untrustedEvent, 'user-1', 'room-1'), /Untrusted IPC sender/);

  const authStateEvent = { sender: mainWindow.webContents };
  ipcMain.__handlers.get('auth-state:get-sync')(authStateEvent);
  assert.deepEqual(authStateEvent.returnValue, { token: 'abc' });

  const blockedAuthStateEvent = { sender: {} };
  ipcMain.__handlers.get('auth-state:get-sync')(blockedAuthStateEvent);
  assert.equal(blockedAuthStateEvent.returnValue, null);
  assert.equal(warnings.length, 1);

  assert.equal(ipcMain.__handles.get('open-external')(trustedEvent, 'https://guild.test'), true);
  assert.deepEqual(externalOpens, ['https://guild.test']);

  assert.equal(
    await ipcMain.__handles.get('system-notification:show')(trustedEvent, {
      title: 'Guild',
      body: 'Ready',
      route: { to: '/rooms/1' },
    }),
    true
  );
  const notification = NotificationStub.instances[0];
  assert.equal(notification.shown, true);
  notification.handlers.get('click')();
  assert.deepEqual(focusCalls, ['focus']);
  assert.deepEqual(notificationActions, [['system-notification:action', { to: '/rooms/1' }]]);

  assert.equal(await ipcMain.__handles.get('download-update')(trustedEvent, 'https://updates.guild.test'), true);
  assert.equal(await ipcMain.__handles.get('apply-update')(trustedEvent, { zipPath: '/tmp/update.zip', tempDir: '/tmp/update' }), true);
  assert.deepEqual(updateCalls, [
    ['download', 'https://updates.guild.test'],
    ['apply', { zipPath: '/tmp/update.zip', tempDir: '/tmp/update' }],
  ]);
});

test('electron IPC runtime can relax trusted-sender checks for shells that intentionally expose the same API without sender gating', () => {
  const ipcMain = createIpcMainStub();
  const runtime = createElectronIpcRuntime({
    appDisplayName: 'Guild',
    appVersion: '1.2.3',
    assetSuffix: 'staging',
    baseDir: '/tmp/client/electron',
    fs: {
      appendFileSync() {},
      existsSync() {
        return false;
      },
    },
    Notification: createNotificationStub(),
    logger: console,
    openExternal() {},
    os: {
      tmpdir() {
        return '/tmp';
      },
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    productSlug: 'guild',
    processEnv: { NODE_ENV: 'development' },
  });

  runtime.registerIpcHandlers({
    app: {
      quit() {},
      relaunch() {},
    },
    appFlavorId: 'production',
    clearAuthBackup() {
      return true;
    },
    deleteMessageCacheEntry() {
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
      return { webContents: { send() {} } };
    },
    getMessageCacheEntry() {
      return { hit: true };
    },
    getManyMessageCacheEntries() {
      return [];
    },
    getRoomSnapshotEntry() {
      return { ok: true };
    },
    getPendingSourceId() {
      return null;
    },
    getScreenCaptureAccessStatus() {
      return 'granted';
    },
    ipcMain,
    isAppleVoiceCaptureSupported() {
      return false;
    },
    openScreenCaptureSettings() {
      return false;
    },
    platform: 'darwin',
    prefetchDesktopSources() {
      return [];
    },
    primeAppleVoiceCapture() {
      return { supported: false };
    },
    readAuthBackup() {
      return { token: 'abc' };
    },
    selectDesktopSource() {
      return true;
    },
    setDesktopSourceCache() {},
    setMessageCacheEntry() {
      return true;
    },
    setRoomSnapshotEntry() {
      return true;
    },
    setPendingSourceId() {},
    startAppleVoiceCaptureSession() {
      return null;
    },
    stopAppleVoiceCaptureSession() {
      return null;
    },
    systemPreferences: {},
    updateRuntime: {
      applyUpdate() {
        return true;
      },
      downloadUpdate() {
        return true;
      },
    },
    writeAuthBackup() {
      return true;
    },
    enforceTrustedMainWindowSender: false,
  });

  const untrustedEvent = { sender: {} };
  assert.deepEqual(ipcMain.__handles.get('message-cache:get')(untrustedEvent, 'user-1', 'msg-1'), { hit: true });
  assert.deepEqual(ipcMain.__handles.get('room-snapshot:get')(untrustedEvent, 'user-1', 'room-1'), { ok: true });
  const authStateEvent = { sender: {}, returnValue: undefined };
  ipcMain.__handlers.get('auth-state:get-sync')(authStateEvent);
  assert.deepEqual(authStateEvent.returnValue, { token: 'abc' });
});
