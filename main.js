const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, desktopCapturer, session, shell, systemPreferences, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const {
  appendAppleVoiceCaptureFrames,
  applyAppleVoiceCaptureReadyPayload,
  buildAppleVoiceCaptureEndedError,
  clearAppleVoiceCaptureFirstFrameTimeout,
  createAppleVoiceCaptureSessionState,
  prepareAppleVoiceCaptureSessionForStop,
  readAppleVoiceJsonLine,
} = require('./client/electron/appleVoiceCaptureSessionRuntime');
const { createAppleVoiceCaptureRuntime } = require('./client/electron/appleVoiceCaptureRuntime');
const { createAppleVoiceHelperRuntime } = require('./client/electron/appleVoiceHelperRuntime');
const {
  createEmptyDesktopSourceCache,
  getDesktopSources,
  getDesktopThumbnails,
  getDesktopWindows,
  getScreenCaptureAccessStatus,
  openScreenCaptureSettings,
  prefetchDesktopSources,
  registerDisplayMediaHandler,
  selectDesktopSource,
} = require('./client/electron/desktopSourceRuntime');
const { createElectronAppLifecycleRuntime } = require('./client/electron/electronAppLifecycleRuntime');
const { createElectronIpcRuntime } = require('./client/electron/electronIpcRuntime');
const { createElectronStartupRuntime } = require('./client/electron/electronStartupRuntime');
const { createPersistedStateRuntime } = require('./client/electron/persistedStateRuntime');
const { createUpdateRuntime } = require('./client/electron/updateRuntime');
const { createElectronWindowRuntime } = require('./client/electron/electronWindowRuntime');
const {
  appFlavor: APP_FLAVOR,
  gotTheLock,
  legacyUpdateSlug: LEGACY_UPDATE_SLUG,
  productName: PRODUCT_NAME,
  productSlug: PRODUCT_SLUG,
  productUiName: PRODUCT_UI_NAME,
  profileId: PROFILE_ID,
  profileLabel: PROFILE_LABEL,
  profilePartition,
  registerSignalHandlers,
  runtimeServerUrl: RUNTIME_SERVER_URL,
} = createElectronStartupRuntime({
  app,
  fs,
  path,
  processRef: process,
  requireFn: require,
  baseDir: __dirname,
}).configureElectronStartup();

if (!gotTheLock) {
  app.quit();
}

let mainWindow;
let tray = null;
let pendingSourceId = null;
const APPLE_VOICE_HELPER_RELATIVE_DIR = path.join('electron', 'native', 'appleVoiceProcessing');
const APPLE_VOICE_HELPER_SOURCE_NAME = 'AppleVoiceIsolationCapture.swift';
const APPLE_VOICE_HELPER_BINARY_NAME = 'apple-voice-isolation-capture';

// Desktop source cache for Mac, pre-warmed when joining a voice channel.
// so the source picker opens instantly instead of waiting for desktopCapturer
let desktopSourceCache = createEmptyDesktopSourceCache();
const appleVoiceCaptureState = {
  disabledReason: null,
  owners: new Set(),
  session: null,
  startPromise: null,
};
const APPLE_VOICE_FIRST_FRAME_TIMEOUT_MS = 1200;
const {
  clearAuthBackup,
  deleteMessageCacheEntry,
  flushAllMessageCacheStates,
  flushAllRoomSnapshotStates,
  getMessageCacheEntry,
  getManyMessageCacheEntries,
  getRoomSnapshotEntry,
  readAuthBackup,
  setMessageCacheEntry,
  setRoomSnapshotEntry,
  writeAuthBackup,
} = createPersistedStateRuntime({
  app,
  fs,
  path,
  logger: console,
});

const APP_VERSION = app.getVersion();
const APP_DISPLAY_NAME = `${PRODUCT_UI_NAME}${PROFILE_LABEL}`;
const appleVoiceHelperRuntime = createAppleVoiceHelperRuntime({
  app,
  fs,
  path,
  spawn,
  processRef: process,
  baseDir: __dirname,
  helperRelativeDir: APPLE_VOICE_HELPER_RELATIVE_DIR,
  sourceName: APPLE_VOICE_HELPER_SOURCE_NAME,
  binaryName: APPLE_VOICE_HELPER_BINARY_NAME,
});
const {
  ensureAppleVoiceHelperBinary,
  isAppleVoiceCapturePlatformSupported,
  normalizeAppleVoiceCaptureOwnerId,
  shouldDisableAppleVoiceCaptureForMessage,
} = appleVoiceHelperRuntime;

const {
  isAppleVoiceCaptureSupported,
  primeAppleVoiceCapture,
  startAppleVoiceCaptureSession,
  stopAppleVoiceCaptureSession,
} = createAppleVoiceCaptureRuntime({
  appendAppleVoiceCaptureFrames,
  applyAppleVoiceCaptureReadyPayload,
  buildAppleVoiceCaptureEndedError,
  clearAppleVoiceCaptureFirstFrameTimeout,
  clearTimeoutFn: clearTimeout,
  createAppleVoiceCaptureSessionState,
  ensureAppleVoiceHelperBinary,
  firstFrameTimeoutMs: APPLE_VOICE_FIRST_FRAME_TIMEOUT_MS,
  isAppleVoiceCapturePlatformSupported,
  normalizeAppleVoiceCaptureOwnerId,
  prepareAppleVoiceCaptureSessionForStop,
  readAppleVoiceJsonLine,
  sendFrame(frame) {
    mainWindow?.webContents.send('apple-voice-capture-frame', frame);
  },
  sendState(payload) {
    mainWindow?.webContents.send('apple-voice-capture-state', payload);
  },
  setTimeoutFn: setTimeout,
  shouldDisableAppleVoiceCaptureForMessage,
  spawn,
  state: appleVoiceCaptureState,
});

const {
  appendDebugLog,
  isSafeExternalHttpUrl,
  openExternalHttpUrl,
  registerIpcHandlers,
  resolveFlavorAssetPath,
} = createElectronIpcRuntime({
  appDisplayName: APP_DISPLAY_NAME,
  appVersion: APP_VERSION,
  assetSuffix: APP_FLAVOR.assetSuffix,
  baseDir: __dirname,
  fs,
  Notification,
  logger: console,
  openExternal: (url) => shell.openExternal(url),
  os,
  path,
  productSlug: PRODUCT_SLUG,
  processEnv: process.env,
});

const updateRuntime = createUpdateRuntime({
  app,
  fs,
  http,
  https,
  isSafeExternalHttpUrl,
  legacyUpdateSlug: LEGACY_UPDATE_SLUG,
  os,
  path,
  processRef: process,
  productName: PRODUCT_NAME,
  productSlug: PRODUCT_SLUG,
  profileId: PROFILE_ID,
  runtimeServerUrl: RUNTIME_SERVER_URL,
  sendUpdateProgress(progress) {
    mainWindow?.webContents.send('update-progress', progress);
  },
  spawn,
});

const {
  createWindow,
  focusMainWindow,
  handleSecondInstance,
  installApplicationMenu,
  setupReadyShell,
} = createElectronWindowRuntime({
  app,
  appDisplayName: APP_DISPLAY_NAME,
  appVersion: APP_VERSION,
  appendDebugLog,
  baseDir: __dirname,
  BrowserWindow,
  dialog,
  enableNavigationGuards: false,
  getMainWindow: () => mainWindow,
  Menu,
  openExternalHttpUrl,
  processRef: process,
  profileId: PROFILE_ID,
  profilePartition,
  resolveFlavorAssetPath,
  runtimeServerUrl: RUNTIME_SERVER_URL,
  mainWindowViteDevServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  mainWindowViteName: MAIN_WINDOW_VITE_NAME,
  setMainWindow: (nextWindow) => {
    mainWindow = nextWindow;
  },
  setTray: (nextTray) => {
    tray = nextTray;
  },
  path,
  Tray,
});

createElectronAppLifecycleRuntime({
  app,
  appDisplayName: APP_DISPLAY_NAME,
  appVersion: APP_VERSION,
  appendDebugLog,
  BrowserWindow,
  clearPendingSourceId: () => {
    pendingSourceId = null;
  },
  createWindow,
  desktopCapturer,
  getPendingSourceId: () => pendingSourceId,
  handleSecondInstance,
  installApplicationMenu,
  ipcMain,
  isAppleVoiceCaptureSupported,
  platform: process.platform,
  primeAppleVoiceCapture,
  profilePartition,
  registerDisplayMediaHandler,
  registerSignalHandlers,
  session,
  setupReadyShell,
  stopAppleVoiceCaptureSession,
  additionalBeforeQuitHandlers: [
    flushAllMessageCacheStates,
    flushAllRoomSnapshotStates,
  ],
}).registerElectronAppLifecycle();

registerIpcHandlers({
  app,
  appFlavorId: APP_FLAVOR.id,
  clearAuthBackup,
  deleteMessageCacheEntry,
  desktopCapturer,
  enforceTrustedMainWindowSender: false,
  focusMainWindow,
  getDesktopSourceCache: () => desktopSourceCache,
  getDesktopSources,
  getDesktopThumbnails,
  getDesktopWindows,
  getMainWindow: () => mainWindow,
  getMessageCacheEntry,
  getManyMessageCacheEntries,
  getPendingSourceId: () => pendingSourceId,
  getRoomSnapshotEntry,
  getScreenCaptureAccessStatus,
  ipcMain,
  isAppleVoiceCaptureSupported,
  openScreenCaptureSettings,
  platform: process.platform,
  prefetchDesktopSources,
  primeAppleVoiceCapture,
  readAuthBackup,
  selectDesktopSource,
  setDesktopSourceCache: (nextCache) => {
    desktopSourceCache = nextCache;
  },
  setMessageCacheEntry,
  setPendingSourceId: (nextSourceId) => {
    pendingSourceId = nextSourceId;
  },
  setRoomSnapshotEntry,
  startAppleVoiceCaptureSession,
  stopAppleVoiceCaptureSession,
  systemPreferences,
  updateRuntime,
  writeAuthBackup,
});
