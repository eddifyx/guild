import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  getDesktopSources,
  getDesktopThumbnails,
  getDesktopWindows,
} = require('../../../client/electron/desktopSourceQueryRuntime.js');
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

test('electron desktop source query runtime loads windows and thumbnails and updates cache consistently', async () => {
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

  const windows = await getDesktopWindows({
    desktopCapturer,
    getCache: () => cache,
    setCache: (next) => {
      cache = next;
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
    now: () => 456,
  });
  const thumbnails = await getDesktopThumbnails({
    desktopCapturer,
    getCache: () => cache,
    setCache: (next) => {
      cache = next;
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
    now: () => 789,
  });

  assert.equal(windows.length, 1);
  assert.equal(Object.keys(thumbnails).length, 2);
  assert.equal(cache.time, 789);
  assert.ok(logs.some(([scope]) => scope === 'desktop-window-sources'));
  assert.ok(logs.some(([scope]) => scope === 'desktop-thumbnails'));
});

test('electron desktop source query runtime resolves source enumeration canonically', async () => {
  let cache = { stale: true };

  const desktopSources = await getDesktopSources({
    platform: 'darwin',
    desktopCapturer: {
      async getSources() {
        return [{ id: 'screen:1', name: 'Screen', thumbnail: null, appIcon: null }];
      },
    },
    setCache: (next) => {
      cache = next;
    },
    now: () => 900,
  });

  assert.equal(desktopSources.length, 1);
  assert.equal(cache.sources.length, 1);
});
