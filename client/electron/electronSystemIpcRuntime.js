function registerSystemIpcHandlers({
  Notification,
  appendDebugLog,
  focusMainWindow,
  getMainWindow,
  getPerfSamples,
  ipcMain,
  openExternalHttpUrl,
  readDebugLogTail,
  recordPerfSample,
  requireTrustedSender,
  resolveFlavorAssetPath,
  updateRuntime,
}) {
  ipcMain.on('perf:sample', (_event, sample) => {
    recordPerfSample(sample);
  });
  ipcMain.handle('perf:get-samples', () => getPerfSamples());

  ipcMain.handle('open-external', (event, url) => {
    requireTrustedSender(event, 'open-external');
    return openExternalHttpUrl(url);
  });
  ipcMain.handle('debug-log', (_event, scope, details) => {
    appendDebugLog(String(scope || 'debug'), String(details || ''));
    return true;
  });
  ipcMain.handle('debug-log:get-tail', (event, scope, limit) => {
    requireTrustedSender(event, 'debug-log:get-tail');
    return readDebugLogTail?.({
      scope: typeof scope === 'string' ? scope : null,
      limit: Number(limit),
    }) || [];
  });

  ipcMain.handle('system-notification:show', async (event, payload) => {
    requireTrustedSender(event, 'system-notification:show');
    if (!Notification?.isSupported?.()) return false;

    const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
    const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
    const route = payload?.route && typeof payload.route === 'object' ? payload.route : null;
    if (!title) return false;

    const notification = new Notification({
      title,
      body,
      silent: true,
      icon: resolveFlavorAssetPath('icon', 'png'),
    });

    notification.on('click', () => {
      focusMainWindow();
      if (route) {
        getMainWindow()?.webContents.send('system-notification:action', route);
      }
    });

    notification.show();
    return true;
  });

  ipcMain.handle('download-update', async (event, updateSource) => {
    requireTrustedSender(event, 'download-update');
    return updateRuntime.downloadUpdate(updateSource);
  });
  ipcMain.handle('apply-update', async (event, { zipPath, tempDir }) => {
    requireTrustedSender(event, 'apply-update');
    return updateRuntime.applyUpdate({ zipPath, tempDir });
  });
}

module.exports = {
  registerSystemIpcHandlers,
};
