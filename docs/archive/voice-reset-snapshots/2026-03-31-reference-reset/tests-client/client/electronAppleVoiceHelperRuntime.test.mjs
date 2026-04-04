import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createAppleVoiceHelperRuntime,
} = require('../../../client/electron/appleVoiceHelperRuntime.js');

function createTmpElectronBaseDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-apple-voice-'));
  const baseDir = path.join(root, 'client', 'electron');
  fs.mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

function touchFile(filePath, contents = '// test\n', mtimeMs = Date.now()) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  const time = new Date(mtimeMs);
  fs.utimesSync(filePath, time, time);
}

test('electron apple voice helper runtime exposes stable platform, disable, and owner helpers', () => {
  const runtime = createAppleVoiceHelperRuntime({
    app: { isPackaged: false },
    fs,
    path,
    spawn: () => { throw new Error('spawn should not run'); },
    processRef: { platform: 'darwin', arch: 'arm64', env: {} },
    baseDir: '/tmp/app/client/electron',
    helperRelativeDir: path.join('electron', 'native', 'appleVoiceProcessing'),
    sourceName: 'AppleVoiceIsolationCapture.swift',
    binaryName: 'apple-voice-isolation-capture',
  });

  assert.equal(runtime.isAppleVoiceCapturePlatformSupported(), true);
  assert.equal(runtime.isAppleVoiceCaptureSupported(null), true);
  assert.equal(runtime.isAppleVoiceCaptureSupported('disabled'), false);
  assert.equal(runtime.normalizeAppleVoiceCaptureOwnerId(), 'default');
  assert.equal(runtime.normalizeAppleVoiceCaptureOwnerId(' room-1 '), 'room-1');
  assert.equal(
    runtime.shouldDisableAppleVoiceCaptureForMessage('VoiceProcessingIO is unavailable on this device'),
    true
  );
  assert.equal(runtime.shouldDisableAppleVoiceCaptureForMessage('ordinary error'), false);
  assert.equal(runtime.getAppleVoiceHelperSourceCandidates().length, 2);
  assert.equal(runtime.getAppleVoiceHelperBinaryCandidates().length, 2);
});

test('electron apple voice helper runtime returns packaged helper binary when present', async () => {
  const baseDir = createTmpElectronBaseDir();
  const runtime = createAppleVoiceHelperRuntime({
    app: { isPackaged: true },
    fs,
    path,
    spawn: () => { throw new Error('spawn should not run'); },
    processRef: { platform: 'darwin', arch: 'arm64', env: {} },
    baseDir,
    helperRelativeDir: path.join('electron', 'native', 'appleVoiceProcessing'),
    sourceName: 'AppleVoiceIsolationCapture.swift',
    binaryName: 'apple-voice-isolation-capture',
  });

  const [sourcePath] = runtime.getAppleVoiceHelperSourceCandidates();
  const [binaryPath] = runtime.getAppleVoiceHelperBinaryCandidates();
  touchFile(sourcePath);
  touchFile(binaryPath, 'binary');

  assert.equal(await runtime.ensureAppleVoiceHelperBinary(), binaryPath);
});

test('electron apple voice helper runtime reuses newer local binaries and compiles missing ones in dev', async () => {
  const baseDir = createTmpElectronBaseDir();
  const helperRelativeDir = path.join('electron', 'native', 'appleVoiceProcessing');
  const sourceName = 'AppleVoiceIsolationCapture.swift';
  const binaryName = 'apple-voice-isolation-capture';
  const compileCalls = [];

  const runtime = createAppleVoiceHelperRuntime({
    app: { isPackaged: false },
    fs,
    path,
    processRef: { platform: 'darwin', arch: 'arm64', env: { TEST_ENV: '1' } },
    baseDir,
    helperRelativeDir,
    sourceName,
    binaryName,
    spawn(command, args, options) {
      compileCalls.push({ command, args, options });
      const proc = new EventEmitter();
      proc.stderr = new EventEmitter();
      process.nextTick(() => {
        const binaryPath = args[args.length - 1];
        touchFile(binaryPath, 'compiled-binary');
        proc.emit('close', 0);
      });
      return proc;
    },
  });

  const localSourcePath = runtime.getAppleVoiceHelperSourceCandidates()[1];
  const localBinaryPath = runtime.getAppleVoiceHelperBinaryCandidates()[1];
  touchFile(localSourcePath, '// source\n', 2_000);
  touchFile(localBinaryPath, 'existing-binary', 3_000);

  assert.equal(await runtime.ensureAppleVoiceHelperBinary(), localBinaryPath);
  assert.equal(compileCalls.length, 0);

  fs.rmSync(localBinaryPath);
  assert.equal(await runtime.ensureAppleVoiceHelperBinary(), localBinaryPath);
  assert.equal(compileCalls.length, 1);
  assert.equal(compileCalls[0].command, 'swiftc');
  assert.match(compileCalls[0].args.join(' '), /AppleVoiceIsolationCapture\.swift/);
  assert.equal(fs.existsSync(localBinaryPath), true);
});

test('electron apple voice helper runtime rejects unsupported platforms and missing packaged binaries', async () => {
  const unsupportedRuntime = createAppleVoiceHelperRuntime({
    app: { isPackaged: false },
    fs,
    path,
    spawn: () => { throw new Error('spawn should not run'); },
    processRef: { platform: 'linux', arch: 'x64', env: {} },
    baseDir: createTmpElectronBaseDir(),
    helperRelativeDir: path.join('electron', 'native', 'appleVoiceProcessing'),
    sourceName: 'AppleVoiceIsolationCapture.swift',
    binaryName: 'apple-voice-isolation-capture',
  });

  await assert.rejects(
    unsupportedRuntime.ensureAppleVoiceHelperBinary(),
    /only available on Apple silicon Macs/
  );

  const packagedRuntime = createAppleVoiceHelperRuntime({
    app: { isPackaged: true },
    fs,
    path,
    spawn: () => { throw new Error('spawn should not run'); },
    processRef: { platform: 'darwin', arch: 'arm64', env: {} },
    baseDir: createTmpElectronBaseDir(),
    helperRelativeDir: path.join('electron', 'native', 'appleVoiceProcessing'),
    sourceName: 'AppleVoiceIsolationCapture.swift',
    binaryName: 'apple-voice-isolation-capture',
  });
  touchFile(packagedRuntime.getAppleVoiceHelperSourceCandidates()[1]);

  await assert.rejects(
    packagedRuntime.ensureAppleVoiceHelperBinary(),
    /binary is missing from the packaged app/
  );
});
