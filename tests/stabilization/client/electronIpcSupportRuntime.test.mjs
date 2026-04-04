import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronIpcSupportRuntime,
  isSafeExternalHttpUrl,
} = require('../../../client/electron/electronIpcSupportRuntime.js');

test('electron IPC support runtime resolves assets, writes debug logs, records perf, gates external URLs, and enforces trusted senders', () => {
  const appendedLogs = [];
  const externalOpens = [];
  const infoLogs = [];
  const runtime = createElectronIpcSupportRuntime({
    assetSuffix: 'staging',
    baseDir: '/tmp/client/electron',
    fs: {
      appendFileSync(...args) {
        appendedLogs.push(args);
      },
      existsSync(candidate) {
        return candidate.endsWith('/assets/icon-staging.png');
      },
    },
    logger: {
      info(...args) {
        infoLogs.push(args);
      },
    },
    openExternal(url) {
      externalOpens.push(url);
    },
    os: {
      tmpdir() {
        return '/tmp';
      },
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
    productSlug: 'guild',
    processEnv: { NODE_ENV: 'development' },
  });

  runtime.appendDebugLog('debug', 'details');
  assert.equal(appendedLogs[0][0], '/tmp/guild-debug.log');
  assert.match(appendedLogs[0][1], /\[debug\] details/);

  runtime.recordPerfSample({ fps: 60 });
  assert.equal(infoLogs.length, 1);
  assert.equal(runtime.getPerfSamples().length, 1);

  assert.equal(runtime.resolveFlavorAssetPath('icon', 'png'), '/tmp/client/electron/../assets/icon-staging.png');
  assert.equal(runtime.openExternalHttpUrl('https://guild.test'), true);
  assert.equal(runtime.openExternalHttpUrl('javascript:alert(1)'), false);
  assert.deepEqual(externalOpens, ['https://guild.test']);
  assert.equal(isSafeExternalHttpUrl('http://guild.test'), true);
  assert.equal(isSafeExternalHttpUrl('file:///tmp/test'), false);

  const mainWindow = { webContents: {} };
  assert.doesNotThrow(() => runtime.requireTrustedMainWindowSender({ sender: mainWindow.webContents }, 'scope', () => mainWindow));
  assert.throws(
    () => runtime.requireTrustedMainWindowSender({ sender: {} }, 'scope', () => mainWindow),
    /Untrusted IPC sender/
  );
});
