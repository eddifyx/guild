import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsStoppedDiagnosticsUpdater,
  cleanupAudioSettingsProcessingRefs,
  stopAudioSettingsStreamRef,
} from '../../../client/src/features/voice/audioSettingsTestRuntimeSupport.mjs';

test('audio settings test runtime support cleans processing refs and monitor routing canonically', () => {
  const destroyed = [];
  const disconnected = [];
  const refs = {
    noiseSuppressorNodeRef: {
      current: {
        destroy() {
          destroyed.push('noiseSuppressor');
        },
        disconnect() {
          disconnected.push('noiseSuppressor');
        },
      },
    },
    residualDenoiserNodeRef: {
      current: {
        destroy() {
          destroyed.push('residualDenoiser');
        },
        disconnect() {
          disconnected.push('residualDenoiser');
        },
      },
    },
    noiseGateNodeRef: {
      current: {
        disconnect() {
          disconnected.push('noiseGate');
        },
      },
    },
    speechFocusChainRef: {
      current: {
        disconnect() {
          disconnected.push('speechFocus');
        },
      },
    },
    keyboardSuppressorNodeRef: {
      current: {
        disconnect() {
          disconnected.push('keyboardSuppressor');
        },
      },
    },
    noiseSuppressionRoutingRef: { current: { processedReady: true } },
    monitorGainRef: { current: { gain: { value: 1 } } },
  };

  cleanupAudioSettingsProcessingRefs(refs);

  assert.deepEqual(destroyed, ['noiseSuppressor', 'residualDenoiser']);
  assert.deepEqual(disconnected, [
    'noiseSuppressor',
    'residualDenoiser',
    'noiseGate',
    'speechFocus',
    'keyboardSuppressor',
  ]);
  assert.equal(refs.noiseSuppressorNodeRef.current, null);
  assert.equal(refs.residualDenoiserNodeRef.current, null);
  assert.equal(refs.noiseGateNodeRef.current, null);
  assert.equal(refs.speechFocusChainRef.current, null);
  assert.equal(refs.keyboardSuppressorNodeRef.current, null);
  assert.equal(refs.noiseSuppressionRoutingRef.current, null);
  assert.equal(refs.monitorGainRef.current, null);
});

test('audio settings test runtime support stops stream refs and nulls the active stream', () => {
  const stopped = [];
  const streamRef = {
    current: {
      getTracks() {
        return [
          { stop() { stopped.push('track-1'); } },
          { stop() { stopped.push('track-2'); } },
        ];
      },
    },
  };

  stopAudioSettingsStreamRef(streamRef);

  assert.deepEqual(stopped, ['track-1', 'track-2']);
  assert.equal(streamRef.current, null);
});

test('audio settings test runtime support builds the stopped diagnostics updater canonically', () => {
  const updater = buildAudioSettingsStoppedDiagnosticsUpdater({
    updatedAt: '2026-03-26T12:00:00.000Z',
  });

  assert.equal(updater(null), null);
  assert.deepEqual(updater({
    playback: {
      state: 'live-playing',
      outputDeviceId: 'speaker-1',
    },
  }), {
    updatedAt: '2026-03-26T12:00:00.000Z',
    playback: {
      state: 'stopped',
      outputDeviceId: 'speaker-1',
    },
  });
});
