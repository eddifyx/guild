function registerCaptureIpcHandlers({
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
  ipcMain.handle('apple-voice-capture-supported', () => isAppleVoiceCaptureSupported());
  ipcMain.handle('apple-voice-capture-prime', async () => {
    return primeAppleVoiceCapture();
  });
  ipcMain.handle('apple-voice-capture-start', async (_event, ownerId) => {
    return startAppleVoiceCaptureSession(ownerId);
  });
  ipcMain.handle('apple-voice-capture-stop', (_event, ownerId) => {
    return stopAppleVoiceCaptureSession(ownerId);
  });

  ipcMain.handle('prefetch-desktop-sources', async () => {
    return prefetchDesktopSources({
      platform,
      desktopCapturer,
      getCache: getDesktopSourceCache,
      setCache: setDesktopSourceCache,
      appendDebugLog,
    });
  });
  ipcMain.handle('get-desktop-sources', async () => {
    return getDesktopSources({
      platform,
      desktopCapturer,
      setCache: setDesktopSourceCache,
    });
  });
  ipcMain.handle('get-desktop-windows', async () => {
    return getDesktopWindows({
      desktopCapturer,
      getCache: getDesktopSourceCache,
      setCache: setDesktopSourceCache,
      appendDebugLog,
    });
  });
  ipcMain.handle('get-desktop-thumbnails', async () => {
    return getDesktopThumbnails({
      desktopCapturer,
      getCache: getDesktopSourceCache,
      setCache: setDesktopSourceCache,
      appendDebugLog,
    });
  });
  ipcMain.handle('select-desktop-source', (_event, sourceId) => {
    selectDesktopSource(sourceId, {
      setPendingSourceId,
      appendDebugLog,
    });
  });
  ipcMain.handle('get-screen-capture-access-status', () => {
    return getScreenCaptureAccessStatus({
      platform,
      systemPreferences,
      appendDebugLog,
    });
  });
  ipcMain.handle('open-screen-capture-settings', async (event) => {
    requireTrustedSender(event, 'open-screen-capture-settings');
    return openScreenCaptureSettings({
      platform,
      openExternal,
      appendDebugLog,
    });
  });
}

module.exports = {
  registerCaptureIpcHandlers,
};
