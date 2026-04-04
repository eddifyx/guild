function registerAppControlIpcHandlers({
  app,
  appFlavorId,
  appVersion,
  getMainWindow,
  ipcMain,
  logger = console,
}) {
  ipcMain.handle('window-minimize', () => getMainWindow()?.minimize());
  ipcMain.handle('window-maximize', () => {
    const mainWindow = getMainWindow();
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window-close', () => getMainWindow()?.close());
  ipcMain.handle('app-relaunch', () => {
    try {
      app.relaunch();
      app.quit();
      return true;
    } catch (err) {
      logger.warn('[App] Failed to relaunch:', err);
      return false;
    }
  });

  ipcMain.handle('get-app-version', () => appVersion);
  ipcMain.on('get-app-flavor-sync', (event) => {
    event.returnValue = appFlavorId;
  });
  ipcMain.on('get-hardware-acceleration-enabled-sync', (event) => {
    try {
      event.returnValue = typeof app.isHardwareAccelerationEnabled === 'function'
        ? app.isHardwareAccelerationEnabled()
        : null;
    } catch {
      event.returnValue = null;
    }
  });
  ipcMain.on('get-gpu-feature-status-sync', (event) => {
    try {
      event.returnValue = typeof app.getGPUFeatureStatus === 'function'
        ? app.getGPUFeatureStatus()
        : null;
    } catch {
      event.returnValue = null;
    }
  });
}

module.exports = {
  registerAppControlIpcHandlers,
};
