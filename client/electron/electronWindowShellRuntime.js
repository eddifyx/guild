const {
  buildDockMenuTemplate,
  buildMacApplicationMenuTemplate,
  buildTrayMenuTemplate,
  buildWindowsJumpListTasks,
} = require('./electronWindowMenuBuilders');
const {
  createElectronWindowShellSetupRuntime,
} = require('./electronWindowShellSetupRuntime');

function createElectronWindowShellRuntime({
  app,
  appDisplayName,
  appVersion,
  dialog,
  getMainWindow,
  Menu,
  processRef = process,
  profileId,
  resolveFlavorAssetPath,
  setTray,
  Tray,
}) {
  function showAboutDialog() {
    return dialog.showMessageBox(getMainWindow(), {
      type: 'info',
      title: `About ${appDisplayName}`,
      message: appDisplayName,
      detail: `Encrypted Messenger\nVersion ${appVersion}`,
      buttons: ['OK'],
      icon: resolveFlavorAssetPath('icon', 'png'),
    });
  }

  function focusMainWindow() {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    if (processRef.platform === 'darwin') {
      try {
        app.focus({ steal: true });
      } catch {
        app.focus();
      }
    }
    mainWindow.focus();
  }

  const setupRuntime = createElectronWindowShellSetupRuntime({
    app,
    appDisplayName,
    appVersion,
    focusMainWindow,
    getMainWindow,
    Menu,
    processRef,
    profileId,
    resolveFlavorAssetPath,
    setTray,
    showAboutDialog,
    Tray,
  });

  return {
    focusMainWindow,
    showAboutDialog,
    ...setupRuntime,
  };
}

module.exports = {
  buildDockMenuTemplate,
  buildMacApplicationMenuTemplate,
  buildTrayMenuTemplate,
  buildWindowsJumpListTasks,
  createElectronWindowShellRuntime,
};
