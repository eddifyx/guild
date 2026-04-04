function resolveUpdateSourceDir({ extractDir, fs, path }) {
  const entries = fs.readdirSync(extractDir);
  if (entries.length === 1) {
    const onlyEntryPath = path.join(extractDir, entries[0]);
    if (fs.statSync(onlyEntryPath).isDirectory()) {
      return onlyEntryPath;
    }
  }
  return extractDir;
}

function findNestedAppBundlePath({ searchDir, appBundleName, fs, path }) {
  for (const entry of fs.readdirSync(searchDir)) {
    const fullPath = path.join(searchDir, entry);
    const stat = fs.statSync(fullPath);
    if (entry === appBundleName && stat.isDirectory()) {
      return fullPath;
    }
    if (stat.isDirectory()) {
      const nested = findNestedAppBundlePath({
        searchDir: fullPath,
        appBundleName,
        fs,
        path,
      });
      if (nested) return nested;
    }
  }
  return null;
}

function quoteMacArgument(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function buildMacRelaunchCommand({ currentAppPath, relaunchArgs }) {
  const quotedArgs = relaunchArgs.map(quoteMacArgument).join(' ');
  return quotedArgs
    ? `open -a "${currentAppPath}" --args ${quotedArgs}`
    : `open "${currentAppPath}"`;
}

function buildMacUpdateScript({
  currentAppPath,
  newAppPath,
  logPath,
  processPid,
  relaunchArgs,
  tempDir,
}) {
  const relaunchCommand = buildMacRelaunchCommand({ currentAppPath, relaunchArgs });
  return [
    '#!/bin/bash',
    `echo "$(date) Update script started" > "${logPath}"`,
    `echo "newAppPath=${newAppPath}" >> "${logPath}"`,
    `echo "currentAppPath=${currentAppPath}" >> "${logPath}"`,
    `kill ${processPid} 2>/dev/null`,
    'sleep 2',
    `rm -rf "${currentAppPath}" >> "${logPath}" 2>&1`,
    `cp -R "${newAppPath}" "${currentAppPath}" >> "${logPath}" 2>&1`,
    `echo "$(date) Copy done" >> "${logPath}"`,
    `${relaunchCommand} >> "${logPath}" 2>&1`,
    `echo "$(date) Relaunch issued" >> "${logPath}"`,
    `rm -rf "${tempDir}"`,
    '',
  ].join('\n');
}

function buildWindowsLaunchTarget({ appDir, exeName, path, relaunchArgs }) {
  const executablePath = path.join(appDir, exeName);
  return relaunchArgs.length
    ? `"${executablePath}" ${relaunchArgs.join(' ')}`
    : `"${executablePath}"`;
}

function buildWindowsUpdateScript({
  appDir,
  exeName,
  launchTarget,
  logPath,
  sourceDir,
}) {
  return [
    '@echo off',
    `echo [%date% %time%] Update script started > "${logPath}"`,
    `echo sourceDir=${sourceDir} >> "${logPath}"`,
    `echo appDir=${appDir} >> "${logPath}"`,
    `echo exeName=${exeName} >> "${logPath}"`,
    `taskkill /IM ${exeName} /F >NUL 2>&1`,
    `echo [%time%] Taskkill issued >> "${logPath}"`,
    'timeout /t 3 /nobreak >NUL',
    `echo [%time%] Starting robocopy >> "${logPath}"`,
    `robocopy "${sourceDir}" "${appDir}" /MIR /R:5 /W:2 >> "${logPath}" 2>&1`,
    `echo [%time%] Robocopy done (errorlevel=%errorlevel%) >> "${logPath}"`,
    `echo [%time%] Launching ${launchTarget} >> "${logPath}"`,
    `start "" ${launchTarget}`,
    `echo [%time%] Launch command issued >> "${logPath}"`,
    '',
  ].join('\r\n');
}

function buildWindowsUpdateVbs({ batPath }) {
  return `CreateObject("Wscript.Shell").Run "cmd /c ""${batPath}""", 0, False\r\n`;
}

module.exports = {
  buildMacRelaunchCommand,
  buildMacUpdateScript,
  buildWindowsLaunchTarget,
  buildWindowsUpdateScript,
  buildWindowsUpdateVbs,
  findNestedAppBundlePath,
  quoteMacArgument,
  resolveUpdateSourceDir,
};
