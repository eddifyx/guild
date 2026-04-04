import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createUpdateExtractRuntime,
  waitForSpawnClose,
} = require('../../../client/electron/updateExtractRuntime.js');

test('electron update extract runtime waits for spawned commands and rejects non-zero exits', async () => {
  await assert.rejects(
    () => waitForSpawnClose({
      spawn() {
        const proc = new EventEmitter();
        process.nextTick(() => proc.emit('close', 1));
        return proc;
      },
      command: 'unzip',
      args: [],
      options: {},
      failureMessage: 'Extraction failed',
    }),
    /Extraction failed \(code 1\)/
  );
});

test('electron update extract runtime extracts archives through the platform-owned command contract', async () => {
  const spawnCalls = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-update-extract-'));
  const runtime = createUpdateExtractRuntime({
    fs,
    path,
    processRef: { platform: 'darwin', arch: 'arm64' },
    spawn(command, args, options) {
      spawnCalls.push([command, args, options]);
      const proc = new EventEmitter();
      process.nextTick(() => proc.emit('close', 0));
      return proc;
    },
  });

  const extractDir = await runtime.extractUpdateArchive({
    zipPath: path.join(tempDir, 'update.zip'),
    tempDir,
  });

  assert.equal(extractDir, path.join(tempDir, 'extracted'));
  assert.equal(spawnCalls[0][0], 'unzip');
  assert.deepEqual(spawnCalls[0][1], ['-o', path.join(tempDir, 'update.zip'), '-d', extractDir]);
});
