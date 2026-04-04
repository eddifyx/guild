const {
  buildDockMenuTemplate,
  buildTrayMenuTemplate,
  buildWindowsJumpListTasks,
} = require('./electronWindowMenuBuilders');

function createElectronWindowReadyShellRuntime({
  app,
  appDisplayName,
  appVersion,
  focusMainWindow,
  getMainWindow,
  Menu,
  processRef = process,
  profileId,
  resolveFlavorAssetPath,
  setTray,
  showAboutDialog,
  Tray,
}) {
  function setupReadyShell() {
    const mainWindow = getMainWindow();

    if (processRef.platform === 'win32') {
      app.setUserTasks(buildWindowsJumpListTasks({
        appDisplayName,
        appVersion,
        processPath: processRef.execPath,
        profileId,
      }));
    }

    if (processRef.argv.includes('--show-about') && mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => showAboutDialog());
    }

    if (processRef.platform === 'darwin' && app.dock) {
      app.dock.setMenu(Menu.buildFromTemplate(
        buildDockMenuTemplate({
          appDisplayName,
          appVersion,
          showAboutPanel: () => app.showAboutPanel(),
        })
      ));
      return;
    }

    if (processRef.platform !== 'darwin') {
      const tray = new Tray(resolveFlavorAssetPath('icon', 'png'));
      setTray(tray);
      tray.setToolTip(`${appDisplayName} v${appVersion}`);
      tray.setContextMenu(Menu.buildFromTemplate(
        buildTrayMenuTemplate({
          appDisplayName,
          appVersion,
          focusMainWindow,
          quitApp: () => app.quit(),
          showAboutDialog,
        })
      ));
      tray.on('click', () => focusMainWindow());
    }
  }

  return {
    setupReadyShell,
  };
}

module.exports = {
  buildDockMenuTemplate,
  buildTrayMenuTemplate,
  buildWindowsJumpListTasks,
  createElectronWindowReadyShellRuntime,
};
