import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScreenShareStartError,
  logScreenShareFailureContext,
} from '../../../client/src/features/voice/screenShareFailure.mjs';

test('screen share failure builder keeps non-mac errors unchanged', async () => {
  const message = await buildScreenShareStartError(new Error('generic failure'), {
    getPlatform: () => 'win32',
  });

  assert.equal(message, 'generic failure');
});

test('screen share failure builder gives targeted macOS window guidance', async () => {
  const message = await buildScreenShareStartError({
    name: 'NotReadableError',
    message: 'Could not start media source',
  }, {
    sourceId: 'window:123',
    includeAudio: true,
    getPlatform: () => 'darwin',
    getScreenCaptureAccessStatus: async () => 'granted',
  });

  assert.match(message, /That macOS window could not be captured/);
  assert.match(message, /Also share audio/);
});

test('screen share failure builder distinguishes granted capture access from generic permission failures', async () => {
  const grantedMessage = await buildScreenShareStartError(new Error('Could not start media source'), {
    sourceId: 'screen:456',
    getPlatform: () => 'darwin',
    getScreenCaptureAccessStatus: async () => 'granted',
  });
  const permissionMessage = await buildScreenShareStartError(new Error('Screen recording permission denied'), {
    sourceId: 'screen:456',
    getPlatform: () => 'darwin',
    getScreenCaptureAccessStatus: async () => 'denied',
  });

  assert.match(grantedMessage, /Screen Recording is already enabled/);
  assert.match(permissionMessage, /Screen sharing could not start on macOS/);
});

test('screen share failure logging returns and reports the serialized payload', () => {
  const consoleCalls = [];
  const debugCalls = [];

  const payload = logScreenShareFailureContext({
    error: new Error('screen share exploded'),
    sourceId: 'screen:999',
    includeAudio: false,
    hasMacAudioDevice: true,
  }, {
    getPlatform: () => 'darwin',
    consoleError: (...args) => consoleCalls.push(args),
    debugLog: (...args) => debugCalls.push(args),
  });

  assert.equal(payload.platform, 'darwin');
  assert.equal(payload.sourceId, 'screen:999');
  assert.equal(payload.hasMacAudioDevice, true);
  assert.equal(consoleCalls.length, 1);
  assert.equal(debugCalls.length, 1);
  assert.equal(debugCalls[0][0], 'screen-share-failure');
});
