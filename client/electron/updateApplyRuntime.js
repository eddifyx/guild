const {
  buildMacRelaunchCommand,
  buildMacUpdateScript,
  buildWindowsLaunchTarget,
  buildWindowsUpdateScript,
  buildWindowsUpdateVbs,
  findNestedAppBundlePath,
  quoteMacArgument,
  resolveUpdateSourceDir,
} = require('./updateApplyModel');

function applyExtractedUpdate({
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
}) {
  const sourceDir = resolveUpdateSourceDir({ extractDir, fs, path });

  if (processRef.platform === 'darwin') {
    const appBundleName = `${productName}.app`;
    let newAppPath = path.join(sourceDir, appBundleName);
    if (!fs.existsSync(newAppPath)) {
      newAppPath = findNestedAppBundlePath({
        searchDir: extractDir,
        appBundleName,
        fs,
        path,
      }) || newAppPath;
    }

    const currentAppPath = processRef.execPath.replace(/\/Contents\/MacOS\/.*$/, '');
    const shPath = path.join(tempDir, 'update.sh');
    const shContent = buildMacUpdateScript({
      currentAppPath,
      newAppPath,
      logPath,
      processPid: processRef.pid,
      relaunchArgs,
      tempDir,
    });

    fs.writeFileSync(shPath, shContent);
    fs.chmodSync(shPath, '755');

    const child = spawn('/bin/bash', [shPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    quitApp();
    return;
  }

  const appDir = path.dirname(processRef.execPath);
  const exeName = path.basename(processRef.execPath);
  const launchTarget = buildWindowsLaunchTarget({
    appDir,
    exeName,
    path,
    relaunchArgs,
  });
  const batPath = path.join(tempDir, 'update.bat');
  const vbsPath = path.join(tempDir, 'update.vbs');

  fs.writeFileSync(batPath, buildWindowsUpdateScript({
    appDir,
    exeName,
    launchTarget,
    logPath,
    sourceDir,
  }));
  fs.writeFileSync(vbsPath, buildWindowsUpdateVbs({ batPath }));

  const child = spawn('wscript.exe', [vbsPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  quitApp();
}

module.exports = {
  applyExtractedUpdate,
  buildMacRelaunchCommand,
  buildMacUpdateScript,
  buildWindowsLaunchTarget,
  buildWindowsUpdateScript,
  buildWindowsUpdateVbs,
  findNestedAppBundlePath,
  quoteMacArgument,
  resolveUpdateSourceDir,
};
