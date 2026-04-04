const {
  detectRuntimeAppFlavor,
  getRuntimeProfile,
  getRuntimeServerUrl,
  sanitizeProfileId,
  sanitizeServerUrl,
} = require('./electronStartupModel');
const {
  loadAppFlavorConfig,
  loadSignalBridge,
} = require('./electronStartupModuleLoader');
const { applyBaseElectronAppSettings } = require('./electronStartupAppSettingsRuntime');
const { configureProfilePaths } = require('./electronStartupProfileRuntime');

function createElectronStartupRuntime({
  app,
  fs,
  path,
  processRef = process,
  requireFn = require,
  baseDir = __dirname,
}) {
  function configureElectronStartup() {
    const { getAppFlavor } = loadAppFlavorConfig({ baseDir, fs, path, requireFn });
    const appFlavor = getAppFlavor(detectRuntimeAppFlavor({ app, processRef }));
    app.setName(appFlavor.menuName || appFlavor.appName);

    const productName = appFlavor.appName;
    const productUiName = appFlavor.uiName;
    const productSlug = appFlavor.productSlug;
    const legacyUpdateSlug = appFlavor.legacyUpdateSlug;
    const argv = Array.isArray(processRef.argv) ? processRef.argv : [];
    const env = processRef.env || {};
    const profileId = getRuntimeProfile(argv, env);
    const runtimeServerUrl = getRuntimeServerUrl(argv, env);
    const profileLabel = profileId ? ` (${profileId})` : '';
    const profilePartition = configureProfilePaths({
      app,
      fs,
      path,
      productSlug,
      profileId,
    });
    const { registerSignalHandlers } = loadSignalBridge({ baseDir, fs, path, requireFn });
    const gotTheLock = applyBaseElectronAppSettings({
      app,
      processRef,
      productSlug,
      profileId,
    });

    return {
      appFlavor,
      gotTheLock,
      legacyUpdateSlug,
      productName,
      productSlug,
      productUiName,
      profileId,
      profileLabel,
      profilePartition,
      registerSignalHandlers,
      runtimeServerUrl,
    };
  }

  return {
    configureElectronStartup,
  };
}

module.exports = {
  createElectronStartupRuntime,
  detectRuntimeAppFlavor,
  getRuntimeProfile,
  getRuntimeServerUrl,
  sanitizeProfileId,
  sanitizeServerUrl,
};
