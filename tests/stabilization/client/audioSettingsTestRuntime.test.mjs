import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanupAudioSettingsAppleSetup,
  stopAudioSettingsTestRuntime,
} from '../../../client/src/features/voice/audioSettingsTestRuntime.mjs';

test('audio settings test runtime cleans up apple setup safely', async () => {
  let stopCalls = 0;
  let previewPaused = false;
  let audioCtxClosed = false;
  let sourceReset = 0;
  let sourceDisconnected = 0;

  const refs = {
    appleVoiceFrameCleanupRef: { current: () => { stopCalls += 1; } },
    appleVoiceStateCleanupRef: { current: () => { stopCalls += 1; } },
    appleVoiceSourceNodeRef: {
      current: {
        port: {
          postMessage(message) {
            if (message?.type === 'reset') {
              sourceReset += 1;
            }
          },
        },
        disconnect() {
          sourceDisconnected += 1;
        },
      },
    },
    previewAudioRef: {
      current: {
        srcObject: { id: 'preview' },
        src: 'blob:test',
        pause() {
          previewPaused = true;
        },
      },
    },
    audioCtxRef: {
      current: {
        async close() {
          audioCtxClosed = true;
        },
      },
    },
  };

  await cleanupAudioSettingsAppleSetup({
    refs,
    deps: {
      stopAppleVoiceCaptureFn: async (...args) => {
        stopCalls += args.length ? 10 : 5;
      },
      stopAppleVoiceCaptureArgs: ['MIC_TEST'],
    },
  });

  assert.equal(previewPaused, true);
  assert.equal(audioCtxClosed, true);
  assert.equal(sourceReset, 1);
  assert.equal(sourceDisconnected, 1);
  assert.equal(stopCalls, 12);
  assert.equal(refs.appleVoiceFrameCleanupRef.current, null);
  assert.equal(refs.appleVoiceStateCleanupRef.current, null);
  assert.equal(refs.appleVoiceSourceNodeRef.current, null);
  assert.equal(refs.previewAudioRef.current, null);
  assert.equal(refs.audioCtxRef.current, null);
});

test('audio settings test runtime stops the active mic test and resets diagnostics', async () => {
  const tracksStopped = [];
  const disconnects = [];
  const destroyed = [];
  const cancelledFrames = [];
  const clearPreviewCalls = [];
  const meterLevels = [];
  const testingStates = [];
  const startingStates = [];
  const appleStopOwners = [];
  let diagnostics = {
    playback: {
      state: 'live-playing',
    },
  };

  const refs = {
    testRunIdRef: { current: 7 },
    animFrameRef: { current: 42 },
    appleVoiceFrameCleanupRef: { current: () => {} },
    appleVoiceStateCleanupRef: { current: () => {} },
    appleVoiceSourceNodeRef: {
      current: {
        port: { postMessage() {} },
        disconnect() {},
      },
    },
    previewAudioRef: {
      current: {
        srcObject: { id: 'preview' },
        src: 'blob:test',
        pause() {},
      },
    },
    audioCtxRef: {
      current: {
        async close() {},
      },
    },
    noiseSuppressorNodeRef: {
      current: {
        destroy() {
          destroyed.push('noiseSuppressor');
        },
        disconnect() {
          disconnects.push('noiseSuppressor');
        },
      },
    },
    residualDenoiserNodeRef: {
      current: {
        destroy() {
          destroyed.push('residualDenoiser');
        },
        disconnect() {
          disconnects.push('residualDenoiser');
        },
      },
    },
    noiseGateNodeRef: {
      current: {
        disconnect() {
          disconnects.push('noiseGate');
        },
      },
    },
    speechFocusChainRef: {
      current: {
        disconnect() {
          disconnects.push('speechFocus');
        },
      },
    },
    keyboardSuppressorNodeRef: {
      current: {
        disconnect() {
          disconnects.push('keyboardSuppressor');
        },
      },
    },
    noiseSuppressionRoutingRef: {
      current: { processedReady: true },
    },
    monitorGainRef: {
      current: { gain: { value: 1 } },
    },
    streamRef: {
      current: {
        getTracks() {
          return [
            { stop() { tracksStopped.push('track-1'); } },
            { stop() { tracksStopped.push('track-2'); } },
          ];
        },
      },
    },
  };

  await stopAudioSettingsTestRuntime({
    refs,
    deps: {
      cancelAnimationFrameFn: (id) => cancelledFrames.push(id),
      stopAppleVoiceCaptureFn: async (owner) => {
        appleStopOwners.push(owner);
      },
      appleVoiceCaptureOwner: 'MIC_TEST',
      clearPreviewPlaybackFn: () => clearPreviewCalls.push('cleared'),
      updateMicMeterFn: (value) => meterLevels.push(value),
      setTestingFn: (value) => testingStates.push(value),
      setTestStartingFn: (value) => startingStates.push(value),
      setTestDiagnosticsFn: (updater) => {
        diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
      },
    },
  });

  assert.equal(refs.testRunIdRef.current, 8);
  assert.deepEqual(cancelledFrames, [42]);
  assert.deepEqual(appleStopOwners, ['MIC_TEST']);
  assert.deepEqual(tracksStopped, ['track-1', 'track-2']);
  assert.deepEqual(destroyed, ['noiseSuppressor', 'residualDenoiser']);
  assert.deepEqual(disconnects, [
    'noiseSuppressor',
    'residualDenoiser',
    'noiseGate',
    'speechFocus',
    'keyboardSuppressor',
  ]);
  assert.deepEqual(clearPreviewCalls, ['cleared']);
  assert.deepEqual(meterLevels, [0]);
  assert.deepEqual(testingStates, [false]);
  assert.deepEqual(startingStates, [false]);
  assert.equal(diagnostics.playback.state, 'stopped');
  assert.equal(refs.noiseSuppressorNodeRef.current, null);
  assert.equal(refs.residualDenoiserNodeRef.current, null);
  assert.equal(refs.noiseGateNodeRef.current, null);
  assert.equal(refs.speechFocusChainRef.current, null);
  assert.equal(refs.keyboardSuppressorNodeRef.current, null);
  assert.equal(refs.noiseSuppressionRoutingRef.current, null);
  assert.equal(refs.monitorGainRef.current, null);
  assert.equal(refs.streamRef.current, null);
});
