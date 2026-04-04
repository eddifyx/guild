import test from 'node:test';
import assert from 'node:assert/strict';

import { applyAudioSettingsTestStopState } from '../../../client/src/features/voice/audioSettingsTestStopState.mjs';

test('audio settings test stop state cleans processing refs, stream, preview, and diagnostics canonically', () => {
  const tracksStopped = [];
  const disconnects = [];
  const destroyed = [];
  const clearPreviewCalls = [];
  const meterLevels = [];
  const testingStates = [];
  let diagnostics = {
    playback: {
      state: 'live-playing',
    },
  };

  const refs = {
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

  applyAudioSettingsTestStopState({
    refs,
    deps: {
      clearPreviewPlaybackFn: () => clearPreviewCalls.push('cleared'),
      updateMicMeterFn: (value) => meterLevels.push(value),
      setTestingFn: (value) => testingStates.push(value),
      setTestDiagnosticsFn: (updater) => {
        diagnostics = typeof updater === 'function' ? updater(diagnostics) : updater;
      },
    },
  });

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
