import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialScreenShareAdaptationState,
  createInitialVoiceDiagnosticsState,
} from '../../../client/src/features/voice/useVoiceControllerState.mjs';

test('useVoice controller state builders return fresh empty diagnostics state', () => {
  const first = createInitialVoiceDiagnosticsState();
  const second = createInitialVoiceDiagnosticsState();

  assert.deepEqual(first, {
    updatedAt: null,
    session: null,
    liveCapture: null,
    senderStats: null,
    screenShare: null,
    consumers: {},
  });
  assert.notEqual(first, second);

  first.consumers.user = { muted: false };
  assert.deepEqual(second.consumers, {});
});

test('useVoice controller state builders return fresh screen-share adaptation state', () => {
  const first = createInitialScreenShareAdaptationState();
  const second = createInitialScreenShareAdaptationState();

  assert.deepEqual(first, {
    degradeSamples: 0,
    recoverySamples: 0,
    lastChangedAtMs: 0,
    lastReason: 'initial',
  });
  assert.notEqual(first, second);

  first.degradeSamples = 2;
  assert.equal(second.degradeSamples, 0);
});
