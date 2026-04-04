import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  prefetchDesktopSources,
} = require('../../../client/electron/desktopSourcePrefetchRuntime.js');
const {
  createEmptyDesktopSourceCache,
} = require('../../../client/electron/desktopSourceModel.js');

function createFakeImage(dataUrl) {
  return {
    isEmpty() {
      return false;
    },
    toDataURL() {
      return dataUrl;
    },
  };
}

test('electron desktop source prefetch runtime populates mac source cache, windows, and thumbnails canonically', async () => {
  let cache = createEmptyDesktopSourceCache();
  const logs = [];
  const goodImage = createFakeImage(`data:image/png;base64,${'b'.repeat(64)}`);

  const desktopCapturer = {
    async getSources(options) {
      if (options.types.length === 1 && options.types[0] === 'screen') {
        return [{ id: 'screen:1', name: 'Screen', thumbnail: goodImage, appIcon: null }];
      }
      if (options.types.length === 1 && options.types[0] === 'window') {
        return [{ id: 'window:2', name: 'Window', thumbnail: goodImage, appIcon: goodImage }];
      }
      return [
        { id: 'screen:1', name: 'Screen', thumbnail: goodImage, appIcon: null },
        { id: 'window:2', name: 'Window', thumbnail: goodImage, appIcon: goodImage },
      ];
    },
  };

  await prefetchDesktopSources({
    platform: 'darwin',
    desktopCapturer,
    getCache: () => cache,
    setCache: (next) => {
      cache = next;
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
    now: () => 123,
  });

  assert.equal(cache.sources.length, 1);
  assert.equal(cache.windows.length, 1);
  assert.equal(cache.thumbnails['window:2'], goodImage.toDataURL());
  assert.ok(logs.some(([scope]) => scope === 'desktop-source-prefetch'));
});

test('electron desktop source prefetch runtime skips non-mac prefetch and tolerates desktop capturer failures', async () => {
  const warnings = [];
  const result = await prefetchDesktopSources({
    platform: 'win32',
    desktopCapturer: {},
    getCache: () => null,
    setCache() {},
    appendDebugLog() {},
  });
  assert.equal(result, null);

  const failed = await prefetchDesktopSources({
    platform: 'darwin',
    desktopCapturer: {
      async getSources() {
        throw new Error('capture failed');
      },
    },
    getCache: () => createEmptyDesktopSourceCache(),
    setCache() {},
    appendDebugLog() {},
    warn(...args) {
      warnings.push(args);
    },
  });
  assert.equal(failed, null);
  assert.equal(warnings.length, 1);
});
