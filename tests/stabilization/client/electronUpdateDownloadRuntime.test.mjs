import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createUpdateDownloadRuntime,
} = require('../../../client/electron/updateDownloadRuntime.js');
const {
  resolveUpdateArchiveUrl,
} = require('../../../client/electron/updateDownloadModel.js');

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

test('electron update download runtime resolves archive URLs canonically', () => {
  assert.equal(
    resolveUpdateArchiveUrl(
      { archiveUrl: ' https://guild.test/update.zip ' },
      { legacyUpdateSlug: 'guild', platform: 'darwin', arch: 'arm64' }
    ),
    'https://guild.test/update.zip'
  );
  assert.equal(
    resolveUpdateArchiveUrl(
      { platformDownload: { archiveUrl: 'https://guild.test/platform.zip' } },
      { legacyUpdateSlug: 'guild', platform: 'darwin', arch: 'arm64' }
    ),
    'https://guild.test/platform.zip'
  );
  assert.equal(
    resolveUpdateArchiveUrl(
      { serverUrl: 'https://guild.test/' },
      { legacyUpdateSlug: 'guild', platform: 'darwin', arch: 'arm64' }
    ),
    'https://guild.test/updates/guild-latest-darwin-arm64.zip'
  );
  assert.equal(
    resolveUpdateArchiveUrl(
      'https://guild.test/',
      { legacyUpdateSlug: 'guild', platform: 'win32', arch: 'x64' }
    ),
    'https://guild.test/updates/guild-latest-win32-x64.zip'
  );
  assert.equal(resolveUpdateArchiveUrl(null, { legacyUpdateSlug: 'guild' }), null);
});

test('electron update download runtime downloads archives and emits throttled progress', async () => {
  const progress = [];
  const requested = [];
  const runtime = createUpdateDownloadRuntime({
    fs,
    http: createDownloadClient({ body: 'unused' }),
    https: createDownloadClient({
      body: 'zip-bytes',
      headers: { 'content-length': '9' },
      onRequest: (url) => requested.push(url),
    }),
    isSafeExternalHttpUrl: () => true,
    legacyUpdateSlug: 'guild',
    nowFn: (() => {
      const ticks = [0, 600];
      return () => ticks.shift() ?? 600;
    })(),
    os,
    path,
    processRef: { platform: 'darwin', arch: 'arm64' },
    productSlug: 'guild',
    sendUpdateProgress: (payload) => progress.push(payload),
    spawn: () => {
      throw new Error('spawn should not run during download');
    },
  });

  const result = await runtime.downloadUpdate({ serverUrl: 'https://guild.test/' });

  assert.equal(requested[0], 'https://guild.test/updates/guild-latest-darwin-arm64.zip');
  assert.equal(fs.existsSync(result.zipPath), true);
  assert.equal(fs.readFileSync(result.zipPath, 'utf8'), 'zip-bytes');
  assert.deepEqual(progress, [
    {
      phase: 'downloading',
      downloadedBytes: 9,
      totalBytes: 9,
      speed: 15,
    },
    {
      phase: 'downloading',
      downloadedBytes: 9,
      totalBytes: 9,
    },
  ]);
});

test('electron update download runtime extracts archives through the platform-owned command contract', async () => {
  const requested = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guild-electron-update-download-'));
  const runtime = createUpdateDownloadRuntime({
    fs,
    http: createDownloadClient({ body: 'unused' }),
    https: createDownloadClient({ body: 'unused' }),
    isSafeExternalHttpUrl: () => true,
    legacyUpdateSlug: 'guild',
    os,
    path,
    processRef: { platform: 'darwin', arch: 'arm64' },
    productSlug: 'guild',
    sendUpdateProgress() {},
    spawn(command, args, options) {
      requested.push([command, args, options]);
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
  assert.equal(requested[0][0], 'unzip');
  assert.deepEqual(requested[0][1], ['-o', path.join(tempDir, 'update.zip'), '-d', extractDir]);
});
