const { createElectronIpcRegistrationRuntime } = require('./electronIpcRegistrationRuntime');
const {
  createElectronIpcSupportRuntime,
  isSafeExternalHttpUrl,
} = require('./electronIpcSupportRuntime');

function createElectronIpcRuntime({
  appVersion,
  assetSuffix,
  baseDir,
  fs,
  Notification,
  logger = console,
  openExternal,
  os,
  path,
  perfSampleLimit = 200,
  processEnv = process.env,
  productSlug,
}) {
  const supportRuntime = createElectronIpcSupportRuntime({
    assetSuffix,
    baseDir,
    fs,
    logger,
    openExternal,
    os,
    path,
    perfSampleLimit,
    processEnv,
    productSlug,
  });

  const registrationRuntime = createElectronIpcRegistrationRuntime({
    Notification,
    appVersion,
    logger,
    openExternal,
    supportRuntime,
  });

  return {
    appendDebugLog: supportRuntime.appendDebugLog,
    isSafeExternalHttpUrl,
    openExternalHttpUrl: supportRuntime.openExternalHttpUrl,
    registerIpcHandlers: registrationRuntime.registerIpcHandlers,
    resolveFlavorAssetPath: supportRuntime.resolveFlavorAssetPath,
  };
}

module.exports = {
  createElectronIpcRuntime,
  isSafeExternalHttpUrl,
};
