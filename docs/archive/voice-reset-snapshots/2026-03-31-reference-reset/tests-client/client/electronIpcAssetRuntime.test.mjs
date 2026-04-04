import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  createElectronIpcAssetRuntime,
  isSafeExternalHttpUrl,
} = require('../../../client/electron/electronIpcAssetRuntime.js');

test('electron IPC asset runtime resolves assets and opens only safe external HTTP URLs', () => {
  const externalOpens = [];
  const runtime = createElectronIpcAssetRuntime({
    assetSuffix: 'staging',
    baseDir: '/tmp/client/electron',
    fs: {
      existsSync(candidate) {
        return candidate.endsWith('/assets/icon-staging.png');
      },
    },
    openExternal(url) {
      externalOpens.push(url);
    },
    path: {
      join: (...parts) => parts.join('/'),
    },
  });

  assert.equal(runtime.resolveFlavorAssetPath('icon', 'png'), '/tmp/client/electron/../assets/icon-staging.png');
  assert.equal(runtime.openExternalHttpUrl('https://guild.test'), true);
  assert.equal(runtime.openExternalHttpUrl('javascript:alert(1)'), false);
  assert.deepEqual(externalOpens, ['https://guild.test']);
  assert.equal(isSafeExternalHttpUrl('http://guild.test'), true);
  assert.equal(isSafeExternalHttpUrl('file:///tmp/test'), false);
});
