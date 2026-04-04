const { registerAppControlIpcHandlers } = require('./electronAppControlIpcRuntime');
const { registerCaptureIpcHandlers } = require('./electronCaptureIpcRuntime');
const { registerPersistedStateIpcHandlers } = require('./electronPersistedStateIpcRuntime');
const {
  buildAppControlIpcOptions,
  buildCaptureIpcOptions,
  buildPersistedStateIpcOptions,
  buildSystemIpcOptions,
  createTrustedSenderGuard,
} = require('./electronIpcRuntimeBindings');
const { registerSystemIpcHandlers } = require('./electronSystemIpcRuntime');

function createElectronIpcRegistrationRuntime({
  Notification,
  appVersion,
  logger = console,
  openExternal,
  supportRuntime,
}) {
  function registerIpcHandlers({
    app,
    appFlavorId,
    clearAuthBackup,
    clearSignerState,
    deleteMessageCacheEntry,
    desktopCapturer,
    focusMainWindow,
    getDesktopSourceCache,
    getDesktopSources,
    getDesktopThumbnails,
    getDesktopWindows,
    getMainWindow,
    getMessageCacheEntry,
    getManyMessageCacheEntries,
    getRoomSnapshotEntry,
    getPendingSourceId,
    getScreenCaptureAccessStatus,
    ipcMain,
    isAppleVoiceCaptureSupported,
    openScreenCaptureSettings,
    platform,
    prefetchDesktopSources,
    primeAppleVoiceCapture,
    readAuthBackup,
    readSignerState,
    selectDesktopSource,
    setDesktopSourceCache,
    setMessageCacheEntry,
    setRoomSnapshotEntry,
    setPendingSourceId,
    startAppleVoiceCaptureSession,
    stopAppleVoiceCaptureSession,
    systemPreferences,
    updateRuntime,
    writeAuthBackup,
    writeSignerState,
    enforceTrustedMainWindowSender = true,
  }) {
    const requireTrustedSender = createTrustedSenderGuard({
      enforceTrustedMainWindowSender,
      getMainWindow,
      requireTrustedMainWindowSender: supportRuntime.requireTrustedMainWindowSender,
    });

    registerAppControlIpcHandlers(buildAppControlIpcOptions({
      app,
      appFlavorId,
      appVersion,
      getMainWindow,
      ipcMain,
      logger,
    }));

    registerCaptureIpcHandlers(buildCaptureIpcOptions({
      appendDebugLog: supportRuntime.appendDebugLog,
      desktopCapturer,
      getDesktopSourceCache,
      getDesktopSources,
      getDesktopThumbnails,
      getDesktopWindows,
      getScreenCaptureAccessStatus,
      ipcMain,
      isAppleVoiceCaptureSupported,
      openExternal,
      openScreenCaptureSettings,
      platform,
      prefetchDesktopSources,
      primeAppleVoiceCapture,
      requireTrustedSender,
      selectDesktopSource,
      setDesktopSourceCache,
      setPendingSourceId,
      startAppleVoiceCaptureSession,
      stopAppleVoiceCaptureSession,
      systemPreferences,
    }));

    registerPersistedStateIpcHandlers(buildPersistedStateIpcOptions({
      clearAuthBackup,
      clearSignerState,
      deleteMessageCacheEntry,
      getMessageCacheEntry,
      getManyMessageCacheEntries,
      getRoomSnapshotEntry,
      ipcMain,
      logger,
      readAuthBackup,
      readSignerState,
      requireTrustedSender,
      setMessageCacheEntry,
      setRoomSnapshotEntry,
      writeAuthBackup,
      writeSignerState,
    }));

    registerSystemIpcHandlers(buildSystemIpcOptions({
      Notification,
      appendDebugLog: supportRuntime.appendDebugLog,
      focusMainWindow,
      getMainWindow,
      getPerfSamples: supportRuntime.getPerfSamples,
      ipcMain,
      openExternalHttpUrl: supportRuntime.openExternalHttpUrl,
      recordPerfSample: supportRuntime.recordPerfSample,
      requireTrustedSender,
      resolveFlavorAssetPath: supportRuntime.resolveFlavorAssetPath,
      updateRuntime,
    }));
  }

  return {
    registerIpcHandlers,
  };
}

module.exports = {
  createElectronIpcRegistrationRuntime,
};
