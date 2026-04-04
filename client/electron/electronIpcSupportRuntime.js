const {
  createElectronIpcAssetRuntime,
  isSafeExternalHttpUrl,
} = require('./electronIpcAssetRuntime');
const { createElectronIpcPerfRuntime } = require('./electronIpcPerfRuntime');

function createElectronIpcSupportRuntime({
  assetSuffix,
  baseDir,
  fs,
  logger = console,
  openExternal,
  os,
  path,
  perfSampleLimit = 200,
  processEnv = process.env,
  productSlug,
}) {
  const assetRuntime = createElectronIpcAssetRuntime({
    assetSuffix,
    baseDir,
    fs,
    openExternal,
    path,
  });
  const perfRuntime = createElectronIpcPerfRuntime({
    fs,
    logger,
    os,
    path,
    perfSampleLimit,
    processEnv,
    productSlug,
  });

  function requireTrustedMainWindowSender(event, scope, getMainWindow) {
    const mainWindow = typeof getMainWindow === 'function' ? getMainWindow() : null;
    if (!mainWindow?.webContents || event.sender !== mainWindow.webContents) {
      throw new Error(`Untrusted IPC sender for ${scope}`);
    }
  }

  return {
    ...assetRuntime,
    ...perfRuntime,
    requireTrustedMainWindowSender,
  };
}

module.exports = {
  createElectronIpcSupportRuntime,
  isSafeExternalHttpUrl,
};
