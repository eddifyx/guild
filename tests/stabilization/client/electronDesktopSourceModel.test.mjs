import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  assignDesktopSourceCache,
  buildDesktopSourceThumbnails,
  createEmptyDesktopSourceCache,
  nativeImageToDataUrl,
  serializeDesktopSource,
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

test('electron desktop source model normalizes cache and desktop image serialization safely', () => {
  const emptyCache = createEmptyDesktopSourceCache();
  const goodImage = createFakeImage(`data:image/png;base64,${'a'.repeat(64)}`);
  const badImage = createFakeImage('data:image/png;base64,short');
  let assigned = null;

  assert.deepEqual(emptyCache, { sources: null, windows: null, thumbnails: null, time: 0 });
  assert.equal(nativeImageToDataUrl(goodImage), goodImage.toDataURL());
  assert.equal(nativeImageToDataUrl(badImage), null);
  assert.deepEqual(
    serializeDesktopSource({
      id: 'screen:1',
      name: 'Primary display',
      thumbnail: goodImage,
      appIcon: goodImage,
    }),
    {
      id: 'screen:1',
      name: 'Primary display',
      thumbnail: goodImage.toDataURL(),
      icon: goodImage.toDataURL(),
    }
  );
  assert.deepEqual(
    buildDesktopSourceThumbnails([
      { id: 'screen:1', thumbnail: goodImage },
      { id: 'screen:2', thumbnail: badImage },
    ]),
    { 'screen:1': goodImage.toDataURL() }
  );
  assert.deepEqual(
    assignDesktopSourceCache(emptyCache, (next) => {
      assigned = next;
    }, { sources: [] }),
    { sources: [] }
  );
  assert.deepEqual(assigned, { sources: [] });
});
