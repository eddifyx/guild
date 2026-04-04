import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildUpdateRelaunchArgs,
  createUpdateRuntime,
} = require('../../../client/electron/updateRuntime.js');

function createTmpUpdateDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-update-'));
}

function createDownloadClient({ body, statusCode = 200, headers = {}, onRequest }) {
  return {
    get(url, callback) {
      onRequest?.(url);
      const request = new EventEmitter();
      process.nextTick(() => {
        const response = new EventEmitter();
        response.statusCode = statusCode;
        response.headers = headers;
        response.pipe = (file) => {
          if (body) {
            file.write(body);
          }
          file.end();
        };
        callback(response);
        if (body) {
          response.emit('data', Buffer.from(body));
        }
      });
      return request;
    },
  };
}

test('electron update runtime builds relaunch args canonically', () => {
  assert.deepEqual(
    buildUpdateRelaunchArgs({
      profileId: 'staging',
      runtimeServerUrl: 'https://guild.test',
    }),
    ['--profile=staging', '--server-url=https://guild.test']
  );
});

test('electron update runtime applies macOS updates through a detached shell script and relaunch args', async () => {
  const progress = [];
  const spawnCalls = [];
  const quitCalls = [];
  const tempDir = createTmpUpdateDir();
  const runtime = createUpdateRuntime({
    app: { isPackaged: true },
    fs,
    http: createDownloadClient({ body: 'unused' }),
    https: createDownloadClient({ body: 'unused' }),
    isSafeExternalHttpUrl: () => true,
    legacyUpdateSlug: 'guild',
    os,
    path,
    processRef: {
      platform: 'darwin',
      arch: 'arm64',
      execPath: '/Applications/Guild.app/Contents/MacOS/Guild',
      pid: 42,
    },
    productName: 'Guild',
    productSlug: 'guild',
    profileId: 'staging',
    runtimeServerUrl: 'https://guild.test',
    sendUpdateProgress: (payload) => progress.push(payload),
    quitApp: () => quitCalls.push('quit'),
    spawn(command, args, options) {
      spawnCalls.push([command, args, options]);
      if (command === 'unzip') {
        const extractDir = args[3];
        fs.mkdirSync(path.join(extractDir, 'release', 'Guild.app'), { recursive: true });
        const proc = new EventEmitter();
        process.nextTick(() => proc.emit('close', 0));
        return proc;
      }
      return {
        unref() {
          spawnCalls.push(['unref']);
        },
      };
    },
  });

  await runtime.applyUpdate({
    zipPath: path.join(tempDir, 'update.zip'),
    tempDir,
  });

  const shPath = path.join(tempDir, 'update.sh');
  const shSource = fs.readFileSync(shPath, 'utf8');

  assert.deepEqual(progress, [{ phase: 'extracting' }, { phase: 'applying' }]);
  assert.match(shSource, /open -a "\/Applications\/Guild\.app" --args "--profile=staging" "--server-url=https:\/\/guild\.test"/);
  assert.match(shSource, /cp -R ".*Guild\.app" "\/Applications\/Guild\.app"/);
  assert.equal(spawnCalls[0][0], 'unzip');
  assert.equal(spawnCalls[1][0], '/bin/bash');
  assert.deepEqual(quitCalls, ['quit']);
});

test('electron update runtime applies Windows updates through hidden script launchers', async () => {
  const progress = [];
  const spawnCalls = [];
  const quitCalls = [];
  const tempDir = createTmpUpdateDir();
  const runtime = createUpdateRuntime({
    app: { isPackaged: true },
    fs,
    http: createDownloadClient({ body: 'unused' }),
    https: createDownloadClient({ body: 'unused' }),
    isSafeExternalHttpUrl: () => true,
    legacyUpdateSlug: 'guild',
    os,
    path,
    processRef: {
      platform: 'win32',
      arch: 'x64',
      execPath: '/opt/Guild/Guild.exe',
      pid: 84,
    },
    productName: 'Guild',
    productSlug: 'guild',
    profileId: 'prod',
    runtimeServerUrl: 'https://guild.test',
    sendUpdateProgress: (payload) => progress.push(payload),
    quitApp: () => quitCalls.push('quit'),
    spawn(command, args, options) {
      spawnCalls.push([command, args, options]);
      if (command === 'powershell.exe') {
        const commandArg = args[2];
        const match = commandArg.match(/-DestinationPath '([^']+)'/);
        const extractDir = match ? match[1] : path.join(tempDir, 'extracted');
        fs.mkdirSync(path.join(extractDir, 'Guild'), { recursive: true });
        const proc = new EventEmitter();
        process.nextTick(() => proc.emit('close', 0));
        return proc;
      }
      return {
        unref() {
          spawnCalls.push(['unref']);
        },
      };
    },
  });

  await runtime.applyUpdate({
    zipPath: path.join(tempDir, 'update.zip'),
    tempDir,
  });

  const batSource = fs.readFileSync(path.join(tempDir, 'update.bat'), 'utf8');
  const vbsSource = fs.readFileSync(path.join(tempDir, 'update.vbs'), 'utf8');

  assert.deepEqual(progress, [{ phase: 'extracting' }, { phase: 'applying' }]);
  assert.match(batSource, /robocopy ".*Guild" "\/opt\/Guild" \/MIR/);
  assert.match(batSource, /start "" "\/opt\/Guild\/Guild\.exe" --profile=prod --server-url=https:\/\/guild\.test/);
  assert.match(vbsSource, /CreateObject\("Wscript\.Shell"\)\.Run/);
  assert.equal(spawnCalls[0][0], 'powershell.exe');
  assert.equal(spawnCalls[1][0], 'wscript.exe');
  assert.deepEqual(quitCalls, ['quit']);
});
