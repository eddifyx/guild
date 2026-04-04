import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  handleDisplayMediaRequest,
  registerDisplayMediaHandler,
  selectDesktopSource,
} = require('../../../client/electron/desktopSourceSelectionRuntime.js');

test('electron desktop source selection runtime handles display-media selection, fallback, and loopback audio canonically', async () => {
  let pendingSourceId = 'window:2';
  const logs = [];
  const warnings = [];
  const callbacks = [];

  await handleDisplayMediaRequest({
    request: { audioRequested: true },
    callback: (value) => callbacks.push(value),
    desktopCapturer: {
      async getSources() {
        return [{ id: 'window:2' }, { id: 'screen:1' }];
      },
    },
    getPendingSourceId: () => pendingSourceId,
    clearPendingSourceId: () => {
      pendingSourceId = null;
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
    platform: 'win32',
    warn: (...args) => warnings.push(args.join(' ')),
  });

  assert.deepEqual(callbacks[0], { video: { id: 'window:2' }, audio: 'loopback' });
  assert.equal(pendingSourceId, null);
  assert.equal(warnings.length, 0);
  assert.ok(logs.some(([, details]) => details.includes('granting source=window:2')));
});

test('electron desktop source selection runtime registers the display-media handler and captures explicit source selections', async () => {
  let registeredHandler = null;
  let pendingSourceId = null;
  const logs = [];
  const callbacks = [];

  const registered = registerDisplayMediaHandler({
    setDisplayMediaRequestHandler(handler) {
      registeredHandler = handler;
    },
  }, {
    desktopCapturer: {
      async getSources() {
        return [{ id: 'screen:1' }];
      },
    },
    getPendingSourceId: () => pendingSourceId,
    clearPendingSourceId: () => {
      pendingSourceId = null;
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
    platform: 'darwin',
  });

  selectDesktopSource('screen:1', {
    setPendingSourceId: (next) => {
      pendingSourceId = next;
    },
    appendDebugLog: (scope, details) => logs.push([scope, details]),
  });

  assert.equal(registered, true);
  assert.equal(typeof registeredHandler, 'function');
  await registeredHandler({ audioRequested: false }, (value) => callbacks.push(value));

  assert.equal(pendingSourceId, null);
  assert.deepEqual(callbacks[0], { video: { id: 'screen:1' } });
  assert.ok(logs.some(([scope]) => scope === 'select-desktop-source'));
});
