import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceCaptureDiagnostics,
  createVoiceCaptureState,
  createVoiceFilterDiagnostics,
  ensureVoiceCaptureBypassRouting,
  setVoiceCaptureOutputTrack,
} from '../../../client/src/features/voice/voiceLiveCaptureState.mjs';

function createGainNode(label) {
  return {
    label,
    gain: { value: null },
    connections: [],
    connect(target) {
      this.connections.push(target);
    },
  };
}

test('voice live capture state builds the canonical capture record', () => {
  const stream = { id: 'stream-1' };
  const sourceTrack = { id: 'track-1' };
  const capture = createVoiceCaptureState({
    stream,
    requestedInputId: 'mic-9',
    usedDefaultDeviceFallback: true,
    sourceTrack,
    reusedExistingStream: false,
  });

  assert.equal(capture.stream, stream);
  assert.equal(capture.requestedInputId, 'mic-9');
  assert.equal(capture.usedDefaultDeviceFallback, true);
  assert.equal(capture.sourceTrack, sourceTrack);
  assert.equal(capture.ownsStream, true);
  assert.equal(capture.usesAppleVoiceProcessing, false);
});

test('voice live capture state builds filter diagnostics and output track modes', () => {
  const filter = createVoiceFilterDiagnostics({
    suppressionRuntime: { backend: 'rnnoise', requiresWarmup: true, fallbackReason: null },
    requestedSuppressionRuntime: { backend: 'apple' },
    noiseSuppressionEnabled: true,
    useRawMicPath: false,
  });
  const capture = createVoiceCaptureState({});
  const sourceTrack = { id: 'source', enabled: false };
  const destinationTrack = { id: 'dest', enabled: false };

  setVoiceCaptureOutputTrack(capture, {
    sourceTrack,
    destinationTrack,
    directSourceTrack: true,
  });
  assert.equal(capture.outputTrack, sourceTrack);
  assert.equal(capture.outputTrackMode, 'direct-source-hotfix');
  assert.equal(sourceTrack.enabled, true);

  setVoiceCaptureOutputTrack(capture, {
    sourceTrack,
    safeMode: true,
  });
  assert.equal(capture.outputTrack, sourceTrack);
  assert.equal(capture.outputTrackMode, 'voice-safe-mode-direct-source');

  assert.deepEqual(filter, {
    backend: 'rnnoise',
    requestedBackend: 'apple',
    suppressionEnabled: true,
    loaded: false,
    requiresWarmup: true,
    fallbackReason: null,
  });
});

test('voice live capture state wires bypass routing only once', () => {
  const capture = createVoiceCaptureState({});
  const micSource = createGainNode('micSource');
  const gainNode = createGainNode('gain');
  const created = [];
  const micCtx = {
    createGain() {
      const node = createGainNode(`node-${created.length}`);
      created.push(node);
      return node;
    },
  };

  const routing = ensureVoiceCaptureBypassRouting(capture, {
    micCtx,
    micSource,
    gainNode,
  });
  const reusedRouting = ensureVoiceCaptureBypassRouting(capture, {
    micCtx,
    micSource,
    gainNode,
  });

  assert.equal(routing, reusedRouting);
  assert.equal(created.length, 3);
  assert.equal(routing.rawBypassGain.gain.value, 1);
  assert.equal(routing.processedGain.gain.value, 0);
  assert.equal(routing.processedMakeupGain.gain.value, 1);
  assert.deepEqual(micSource.connections, [routing.rawBypassGain]);
  assert.deepEqual(routing.rawBypassGain.connections, [gainNode]);
  assert.deepEqual(routing.processedGain.connections, [routing.processedMakeupGain]);
  assert.deepEqual(routing.processedMakeupGain.connections, [gainNode]);
});

test('voice live capture state builds stable diagnostics payloads', () => {
  const diagnostics = buildVoiceCaptureDiagnostics({
    channelId: 'channel-1',
    startedAt: '2026-03-25T00:00:00.000Z',
    mode: 'balanced',
    requestedConstraints: { deviceId: 'mic-1' },
    usedDefaultDeviceFallback: false,
    reusedSourceStream: true,
    sourceTrack: { id: 'source' },
    producedTrack: { id: 'output' },
    outputTrackMode: 'processed-destination',
    audioContext: { state: 'running' },
    filter: { backend: 'rnnoise' },
    getUserMediaMs: 10,
    audioGraphSetupMs: 20,
    totalMs: 30,
    error: 'nope',
  });

  assert.deepEqual(diagnostics, {
    channelId: 'channel-1',
    startedAt: '2026-03-25T00:00:00.000Z',
    mode: 'balanced',
    requestedConstraints: { deviceId: 'mic-1' },
    usedDefaultDeviceFallback: false,
    reusedSourceStream: true,
    sourceTrack: { id: 'source' },
    producedTrack: { id: 'output' },
    outputTrackMode: 'processed-destination',
    audioContext: { state: 'running' },
    filter: { backend: 'rnnoise' },
    timingsMs: {
      getUserMedia: 10,
      audioGraphSetup: 20,
      total: 30,
    },
    error: 'nope',
  });
});
