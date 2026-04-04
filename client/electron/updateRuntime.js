const { applyExtractedUpdate } = require('./updateApplyRuntime');
const {
  createUpdateDownloadRuntime,
  resolveUpdateArchiveUrl,
} = require('./updateDownloadRuntime');

function buildUpdateRelaunchArgs({ profileId, runtimeServerUrl } = {}) {
  const args = [];
  if (profileId) {
    args.push(`--profile=${profileId}`);
  }
  if (runtimeServerUrl) {
    args.push(`--server-url=${runtimeServerUrl}`);
  }
  return args;
}

function createUpdateRuntime({
  app,
  fs,
  http,
  https,
  isSafeExternalHttpUrl,
  legacyUpdateSlug,
  nowFn = () => Date.now(),
  os,
  path,
  processRef = process,
  productName,
  productSlug,
  profileId,
  runtimeServerUrl,
  sendUpdateProgress,
  spawn,
  quitApp = () => app.quit(),
}) {
  const downloadRuntime = createUpdateDownloadRuntime({
    fs,
    http,
    https,
    isSafeExternalHttpUrl,
    legacyUpdateSlug,
    nowFn,
    os,
    path,
    processRef,
    productSlug,
    sendUpdateProgress,
    spawn,
  });

  function getRelaunchArgs() {
    return buildUpdateRelaunchArgs({
      profileId,
      runtimeServerUrl,
    });
  }

  async function applyUpdate({ zipPath, tempDir }) {
    if (!app.isPackaged) {
      throw new Error('Cannot apply updates in dev mode. Run from a packaged build to test the full update flow.');
    }

    if (typeof sendUpdateProgress === 'function') {
      sendUpdateProgress({ phase: 'extracting' });
    }
    const extractDir = await downloadRuntime.extractUpdateArchive({ zipPath, tempDir });

    if (typeof sendUpdateProgress === 'function') {
      sendUpdateProgress({ phase: 'applying' });
    }
    const logPath = path.join(os.tmpdir(), `${productSlug}-update.log`);
    const relaunchArgs = getRelaunchArgs();
    applyExtractedUpdate({
      extractDir,
      fs,
      logPath,
      os,
      path,
      processRef,
      productName,
      productSlug,
      quitApp,
      relaunchArgs,
      spawn,
      tempDir,
    });
  }

  return {
    applyUpdate,
    buildUpdateRelaunchArgs: getRelaunchArgs,
    downloadUpdate: downloadRuntime.downloadUpdate,
    resolveUpdateArchiveUrl: downloadRuntime.resolveUpdateArchiveUrl,
  };
}

module.exports = {
  buildUpdateRelaunchArgs,
  createUpdateRuntime,
  resolveUpdateArchiveUrl,
};
