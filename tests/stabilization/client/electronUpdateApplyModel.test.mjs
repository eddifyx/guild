import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildMacRelaunchCommand,
  buildMacUpdateScript,
  buildWindowsLaunchTarget,
  buildWindowsUpdateScript,
  buildWindowsUpdateVbs,
  findNestedAppBundlePath,
  resolveUpdateSourceDir,
} = require('../../../client/electron/updateApplyModel.js');

function createTmpUpdateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-update-apply-'));
}

test('electron update apply model resolves extracted source dirs and nested app bundles canonically', () => {
  const tempDir = createTmpUpdateDir();
  const extractDir = path.join(tempDir, 'extracted');
  const releaseDir = path.join(extractDir, 'release');
  const nestedApp = path.join(releaseDir, 'Guild.app');

  fs.mkdirSync(nestedApp, { recursive: true });

  assert.equal(
    resolveUpdateSourceDir({ extractDir, fs, path }),
    releaseDir
  );
  assert.equal(
    findNestedAppBundlePath({
      searchDir: extractDir,
      appBundleName: 'Guild.app',
      fs,
      path,
    }),
    nestedApp
  );
});

test('electron update apply model builds canonical mac and windows relaunch scripts', () => {
  assert.match(
    buildMacRelaunchCommand({
      currentAppPath: '/Applications/Guild.app',
      relaunchArgs: ['--profile=staging', '--server-url=https://guild.test'],
    }),
    /open -a "\/Applications\/Guild\.app" --args "--profile=staging" "--server-url=https:\/\/guild\.test"/
  );

  assert.match(
    buildMacUpdateScript({
      currentAppPath: '/Applications/Guild.app',
      newAppPath: '/tmp/release/Guild.app',
      logPath: '/tmp/guild-update.log',
      processPid: 42,
      relaunchArgs: ['--profile=staging'],
      tempDir: '/tmp/update',
    }),
    /cp -R "\/tmp\/release\/Guild\.app" "\/Applications\/Guild\.app"/
  );

  assert.equal(
    buildWindowsLaunchTarget({
      appDir: '/opt/Guild',
      exeName: 'Guild.exe',
      path,
      relaunchArgs: ['--profile=prod', '--server-url=https://guild.test'],
    }),
    '"\\/opt\\/Guild\\/Guild.exe" --profile=prod --server-url=https://guild.test'.replace(/\\/g, '')
  );

  assert.match(
    buildWindowsUpdateScript({
      appDir: '/opt/Guild',
      exeName: 'Guild.exe',
      launchTarget: '"/opt/Guild/Guild.exe" --profile=prod',
      logPath: '/tmp/guild-update.log',
      sourceDir: '/tmp/release/Guild',
    }),
    /robocopy "\/tmp\/release\/Guild" "\/opt\/Guild" \/MIR/
  );
  assert.match(buildWindowsUpdateVbs({ batPath: 'C:\\temp\\update.bat' }), /CreateObject\("Wscript\.Shell"\)\.Run/);
});
