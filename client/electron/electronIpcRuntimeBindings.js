function createTrustedSenderGuard({
  enforceTrustedMainWindowSender = true,
  getMainWindow,
  requireTrustedMainWindowSender,
}) {
  return (event, scope) => {
    if (!enforceTrustedMainWindowSender) {
      return;
    }
    requireTrustedMainWindowSender(event, scope, getMainWindow);
  };
}

function buildAppControlIpcOptions({
  app,
  appFlavorId,
  appVersion,
  getMainWindow,
  ipcMain,
  logger,
}) {
  return {
    app,
    appFlavorId,
    appVersion,
    getMainWindow,
    ipcMain,
    logger,
  };
}

function buildCaptureIpcOptions({
  appendDebugLog,
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
}) {
  return {
    appendDebugLog,
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
  };
}

function buildPersistedStateIpcOptions({
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
}) {
  return {
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
  };
}

function buildSystemIpcOptions({
  Notification,
  appendDebugLog,
  focusMainWindow,
  getMainWindow,
  getPerfSamples,
  ipcMain,
  openExternalHttpUrl,
  recordPerfSample,
  requireTrustedSender,
  resolveFlavorAssetPath,
  updateRuntime,
}) {
  return {
    Notification,
    appendDebugLog,
    focusMainWindow,
    getMainWindow,
    getPerfSamples,
    ipcMain,
    openExternalHttpUrl,
    recordPerfSample,
    requireTrustedSender,
    resolveFlavorAssetPath,
    updateRuntime,
  };
}

module.exports = {
  buildAppControlIpcOptions,
  buildCaptureIpcOptions,
  buildPersistedStateIpcOptions,
  buildSystemIpcOptions,
  createTrustedSenderGuard,
};
