import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  applyExtractedUpdate,
} = require('../../../client/electron/updateApplyRuntime.js');

function createTmpUpdateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-update-apply-'));
}

test('electron update apply runtime applies extracted macOS and Windows updates through detached launchers', () => {
  const tempDir = createTmpUpdateDir();
  const extractDir = path.join(tempDir, 'extracted');
  const macReleaseDir = path.join(extractDir, 'release');
  const macAppPath = path.join(macReleaseDir, 'Guild.app');
  fs.mkdirSync(macAppPath, { recursive: true });

  const macSpawnCalls = [];
  const macQuitCalls = [];
  applyExtractedUpdate({
    extractDir,
    fs,
    logPath: path.join(tempDir, 'mac.log'),
    os,
    path,
    processRef: {
      platform: 'darwin',
      execPath: '/Applications/Guild.app/Contents/MacOS/Guild',
      pid: 42,
    },
    productName: 'Guild',
    productSlug: 'guild',
    quitApp: () => macQuitCalls.push('quit'),
    relaunchArgs: ['--profile=staging'],
    spawn(command, args, options) {
      macSpawnCalls.push([command, args, options]);
      return {
        unref() {
          macSpawnCalls.push(['unref']);
        },
      };
    },
    tempDir,
  });

  assert.equal(macSpawnCalls[0][0], '/bin/bash');
  assert.deepEqual(macQuitCalls, ['quit']);
  assert.equal(fs.existsSync(path.join(tempDir, 'update.sh')), true);

  const windowsSpawnCalls = [];
  const windowsQuitCalls = [];
  const windowsExtractDir = path.join(tempDir, 'win-extracted');
  fs.mkdirSync(path.join(windowsExtractDir, 'Guild'), { recursive: true });
  applyExtractedUpdate({
    extractDir: windowsExtractDir,
    fs,
    logPath: path.join(tempDir, 'win.log'),
    os,
    path,
    processRef: {
      platform: 'win32',
      execPath: '/opt/Guild/Guild.exe',
      pid: 84,
    },
    productName: 'Guild',
    productSlug: 'guild',
    quitApp: () => windowsQuitCalls.push('quit'),
    relaunchArgs: ['--profile=prod'],
    spawn(command, args, options) {
      windowsSpawnCalls.push([command, args, options]);
      return {
        unref() {
          windowsSpawnCalls.push(['unref']);
        },
      };
    },
    tempDir,
  });

  assert.equal(windowsSpawnCalls[0][0], 'wscript.exe');
  assert.deepEqual(windowsQuitCalls, ['quit']);
  assert.equal(fs.existsSync(path.join(tempDir, 'update.bat')), true);
  assert.equal(fs.existsSync(path.join(tempDir, 'update.vbs')), true);
});
