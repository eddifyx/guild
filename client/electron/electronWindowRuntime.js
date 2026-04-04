const {
  buildSystemContextMenuTemplate,
  buildWindowContextMenuTemplate,
} = require('./electronWindowMenuBuilders');
const {
  buildBrowserWindowOptions,
  buildWindowRuntimeQuery,
} = require('./electronWindowModel');
const {
  createElectronWindowContentRuntime,
} = require('./electronWindowContentRuntime');
const {
  createElectronWindowShellRuntime,
} = require('./electronWindowShellRuntime');

function createElectronWindowRuntime({
  app,
  appDisplayName,
  appVersion,
  appendDebugLog,
  baseDir,
  BrowserWindow,
  dialog,
  enableNavigationGuards = true,
  getMainWindow,
  Menu,
  openExternalHttpUrl,
  processRef = process,
  profileId,
  profilePartition,
  resolveFlavorAssetPath,
  runtimeServerUrl,
  mainWindowViteDevServerUrl,
  mainWindowViteName,
  setMainWindow,
  setTray,
  path,
  Tray,
}) {
  const shellRuntime = createElectronWindowShellRuntime({
    app,
    appDisplayName,
    appVersion,
    dialog,
    getMainWindow,
    Menu,
    processRef,
    profileId,
    resolveFlavorAssetPath,
    setTray,
    Tray,
  });
  const contentRuntime = createElectronWindowContentRuntime({
    appDisplayName,
    appVersion,
    appendDebugLog,
    baseDir,
    enableNavigationGuards,
    mainWindowViteDevServerUrl,
    mainWindowViteName,
    Menu,
    openExternalHttpUrl,
    path,
    runtimeServerUrl,
    shellRuntime,
  });

  function createWindow() {
    const mainWindow = new BrowserWindow(buildBrowserWindowOptions({
      appDisplayName,
      iconPath: resolveFlavorAssetPath('icon', 'png'),
      preloadPath: path.join(baseDir, 'preload.js'),
      profileId,
      profilePartition,
    }));
    setMainWindow(mainWindow);
    return contentRuntime.bindWindowContent(mainWindow);
  }

  return {
    createWindow,
    ...shellRuntime,
  };
}

module.exports = {
  buildBrowserWindowOptions,
  buildSystemContextMenuTemplate,
  buildWindowContextMenuTemplate,
  buildWindowRuntimeQuery,
  createElectronWindowRuntime,
};
