const {
  buildMacApplicationMenuTemplate,
} = require('./electronWindowMenuBuilders');
const {
  createElectronWindowReadyShellRuntime,
} = require('./electronWindowReadyShellRuntime');

function createElectronWindowShellSetupRuntime({
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
  function installApplicationMenu() {
    if (processRef.platform === 'darwin') {
      Menu.setApplicationMenu(Menu.buildFromTemplate(
        buildMacApplicationMenuTemplate({
          app,
          appDisplayName,
        })
      ));
      return true;
    }

    Menu.setApplicationMenu(null);
    return false;
  }

  function handleSecondInstance(commandLine = []) {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    if (commandLine.includes('--show-about')) {
      showAboutDialog();
    }
  }
  const readyShellRuntime = createElectronWindowReadyShellRuntime({
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
    handleSecondInstance,
    installApplicationMenu,
    ...readyShellRuntime,
  };
}

module.exports = {
  buildMacApplicationMenuTemplate,
  createElectronWindowShellSetupRuntime,
};
