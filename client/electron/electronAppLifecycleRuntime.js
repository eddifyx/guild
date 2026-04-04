function buildAboutPanelOptions({ appDisplayName, appVersion }) {
  return {
    applicationName: appDisplayName,
    applicationVersion: appVersion,
    version: appVersion,
    copyright: '/guild encrypted messenger',
  };
}

function buildDisplayMediaHandlerOptions({
  appendDebugLog,
  clearPendingSourceId,
  desktopCapturer,
  getPendingSourceId,
  platform,
}) {
  return {
    appendDebugLog,
    clearPendingSourceId,
    desktopCapturer,
    getPendingSourceId,
    platform,
  };
}

function createElectronAppLifecycleRuntime({
  app,
  appDisplayName,
  appVersion,
  appendDebugLog,
  BrowserWindow,
  clearPendingSourceId,
  createWindow,
  desktopCapturer,
  getPendingSourceId,
  handleSecondInstance,
  installApplicationMenu,
  ipcMain,
  isAppleVoiceCaptureSupported,
  logger = console,
  platform,
  primeAppleVoiceCapture,
  profilePartition,
  registerDisplayMediaHandler,
  registerSignalHandlers,
  session,
  setupReadyShell,
  stopAppleVoiceCaptureSession,
  additionalBeforeQuitHandlers = [],
  setTimeoutFn = setTimeout,
  warmupDelayMs = 1200,
}) {
  function registerElectronAppLifecycle() {
    app.setAboutPanelOptions(buildAboutPanelOptions({ appDisplayName, appVersion }));
    installApplicationMenu();

    app.on('second-instance', (event, commandLine) => {
      handleSecondInstance(commandLine);
    });

    app.whenReady().then(() => {
      registerSignalHandlers(ipcMain);
      createWindow();

      if (isAppleVoiceCaptureSupported()) {
        setTimeoutFn(() => {
          void primeAppleVoiceCapture().catch((error) => {
            logger.warn('[Voice] Apple voice helper warm-up failed:', error?.message || error);
          });
        }, warmupDelayMs);
      }

      const displayMediaHandlerOptions = buildDisplayMediaHandlerOptions({
        appendDebugLog,
        clearPendingSourceId,
        desktopCapturer,
        getPendingSourceId,
        platform,
      });
      registerDisplayMediaHandler(session.defaultSession, displayMediaHandlerOptions);
      registerDisplayMediaHandler(
        session.fromPartition(profilePartition),
        displayMediaHandlerOptions
      );
      setupReadyShell();
    });

    app.on('before-quit', () => {
      stopAppleVoiceCaptureSession();
      for (const handler of additionalBeforeQuitHandlers) {
        handler();
      }
    });

    app.on('window-all-closed', () => {
      if (platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }

  return {
    registerElectronAppLifecycle,
  };
}

module.exports = {
  buildAboutPanelOptions,
  buildDisplayMediaHandlerOptions,
  createElectronAppLifecycleRuntime,
};
