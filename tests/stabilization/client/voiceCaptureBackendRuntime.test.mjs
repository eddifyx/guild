import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoiceProcessingRouting,
  resolveAppleVoiceRuntimeDeps,
  resolveVoiceNoiseRuntimeDeps,
  startVoiceCaptureProcessingBackend,
  withVoiceProcessingTimeout,
} from '../../../client/src/features/voice/voiceCaptureBackendRuntime.mjs';

test('voice capture backend runtime toggles direct and processed gains through one helper', () => {
  const routing = {
    processedReady: true,
    rawBypassGain: { gain: { value: 1 } },
    processedGain: { gain: { value: 0 } },
  };

  const enabled = applyVoiceProcessingRouting(routing, true);
  assert.equal(enabled, true);
  assert.equal(routing.rawBypassGain.gain.value, 0);
  assert.equal(routing.processedGain.gain.value, 1);

  const disabled = applyVoiceProcessingRouting(routing, false);
  assert.equal(disabled, false);
  assert.equal(routing.rawBypassGain.gain.value, 1);
  assert.equal(routing.processedGain.gain.value, 0);
});

test('voice capture backend runtime resolves provided dependency overrides without dynamic imports', async () => {
  const appleDeps = await resolveAppleVoiceRuntimeDeps({
    createApplePcmBridgeNodeFn: () => 'bridge',
    getFriendlyAppleVoiceFallbackMessageFn: (message) => `friendly:${message}`,
    normalizeElectronBinaryChunkFn: (chunk) => chunk,
    shouldDisableAppleVoiceForSessionFn: () => true,
  });
  assert.equal(appleDeps.createApplePcmBridgeNodeFn(), 'bridge');
  assert.equal(appleDeps.getFriendlyAppleVoiceFallbackMessageFn('x'), 'friendly:x');
  assert.equal(appleDeps.shouldDisableAppleVoiceForSessionFn(), true);

  const voiceNoiseDeps = await resolveVoiceNoiseRuntimeDeps({
    createNoiseGateNodeFn: () => 'gate',
    createRnnoiseNodeFn: () => 'rnnoise',
    createSpeexNodeFn: () => 'speex',
    createKeyboardSuppressorNodeFn: () => 'keyboard',
    createSpeechFocusChainFn: () => 'speech',
  });
  assert.equal(voiceNoiseDeps.createNoiseGateNodeFn(), 'gate');
  assert.equal(voiceNoiseDeps.createRnnoiseNodeFn(), 'rnnoise');
  assert.equal(voiceNoiseDeps.createSpeexNodeFn(), 'speex');
  assert.equal(voiceNoiseDeps.createKeyboardSuppressorNodeFn(), 'keyboard');
  assert.equal(voiceNoiseDeps.createSpeechFocusChainFn(), 'speech');
});

test('voice capture backend runtime applies timeout guards', async () => {
  await assert.rejects(
    withVoiceProcessingTimeout(new Promise(() => {}), 0, 'timed out'),
    /timed out/,
  );
});

test('voice capture backend runtime delegates processed backend startup through canonical helpers', async () => {
  const calls = [];
  const result = await startVoiceCaptureProcessingBackend({
    capture: { id: 'capture-1' },
    micCtx: { id: 'ctx-1' },
    micSource: { id: 'source-1' },
    gainNode: { id: 'gain-1' },
    useRawMicPath: false,
    suppressionRuntime: { backend: 'apple-voice-processing' },
    activeVoiceProcessingMode: 'studio',
    noiseSuppressionEnabled: true,
    requestedSuppressionRuntime: { backend: 'apple-voice-processing' },
    filterDiagnostics: { backend: 'apple-voice-processing' },
    refs: {
      liveCaptureRef: { current: null },
      appleVoiceAvailableRef: { current: true },
    },
    deps: {
      ensureVoiceCaptureBypassRoutingFn: () => ({
        processedReady: true,
        rawBypassGain: { gain: { value: 1 } },
        processedGain: { gain: { value: 0 } },
      }),
      resolveAppleVoiceRuntimeDepsFn: async () => ({
        createApplePcmBridgeNodeFn: () => 'bridge',
        normalizeElectronBinaryChunkFn: (value) => value,
        getFriendlyAppleVoiceFallbackMessageFn: (message) => `friendly:${message}`,
        shouldDisableAppleVoiceForSessionFn: () => false,
      }),
      startAppleVoiceProcessingLaneFn: async () => {
        calls.push('apple-lane');
        return { workletCreateMs: 12 };
      },
      resolveVoiceNoiseRuntimeDepsFn: async () => ({
        createNoiseGateNodeFn: () => 'gate',
        createRnnoiseNodeFn: () => 'rnnoise',
        createSpeexNodeFn: () => 'speex',
        createKeyboardSuppressorNodeFn: () => 'keyboard',
        createSpeechFocusChainFn: () => 'speech',
      }),
      startRnnoiseVoiceProcessingLaneFn: async () => {
        calls.push('rnnoise-lane');
        return { workletCreateMs: 18 };
      },
      startVoiceCaptureBackendFn: async (options) => {
        calls.push('backend');
        await options.startAppleProcessingLaneFn();
        const rnnoiseResult = await options.startRnnoiseProcessingLaneFn({ backend: 'rnnoise' });
        assert.equal(rnnoiseResult.workletCreateMs, 18);
        return {
          suppressionRuntime: { backend: 'rnnoise' },
          workletCreateMs: 18,
        };
      },
    },
  });

  assert.deepEqual(calls, ['backend', 'apple-lane', 'rnnoise-lane']);
  assert.deepEqual(result, {
    suppressionRuntime: { backend: 'rnnoise' },
    workletCreateMs: 18,
  });
});
