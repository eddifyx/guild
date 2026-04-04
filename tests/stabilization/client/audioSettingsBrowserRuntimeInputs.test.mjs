import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsBrowserGraphInput,
  buildAudioSettingsBrowserWarmupInput,
} from '../../../client/src/features/voice/audioSettingsBrowserRuntimeInputs.mjs';

test('audio settings browser runtime inputs build canonical graph and warmup contracts', () => {
  const graphInput = buildAudioSettingsBrowserGraphInput({
    refs: {
      testRunIdRef: { current: 1 },
      audioCtxRef: { current: null },
      gainRef: { current: null },
      noiseSuppressionRoutingRef: { current: null },
    },
    deps: {
      stream: { id: 'stream-1' },
      runId: 7,
      activeVoiceMode: 'standard',
      activeOutputId: 'speaker-1',
      monitorProfile: { id: 'studio' },
      outputSelection: { usedDefaultFallback: false },
      requestedOutputDeviceId: 'speaker-1',
      noiseSuppressionEnabled: true,
      useRawMicPath: false,
      requestedSuppressionRuntime: { backend: 'rnnoise' },
      attachMonitorOutputFn: () => {},
      addPerfPhaseFn: () => {},
      perfTraceId: 'trace-1',
      audioContextCtor: class {},
      getVoiceAudioContextOptionsFn: () => undefined,
      summarizeTrackSnapshotFn: () => ({}),
      summarizeAudioContextFn: () => ({}),
      resolveNoiseSuppressionRuntimeStateFn: () => ({}),
      performanceNowFn: () => 1,
      roundMsFn: (value) => value,
      readStoredMicGainFn: () => 1.5,
      voiceNoiseSuppressionBackends: { RNNOISE: 'rnnoise' },
      rnnoiseMonitorMakeupGain: 1,
    },
  });

  const warmupInput = buildAudioSettingsBrowserWarmupInput({
    refs: {
      testRunIdRef: { current: 1 },
      audioCtxRef: { current: null },
      processingModeRef: { current: 'standard' },
      noiseSuppressionRef: { current: true },
      noiseSuppressorNodeRef: { current: null },
      residualDenoiserNodeRef: { current: null },
      noiseGateNodeRef: { current: null },
      speechFocusChainRef: { current: null },
      keyboardSuppressorNodeRef: { current: null },
      noiseSuppressionRoutingRef: { current: null },
    },
    deps: {
      ctx: { id: 'ctx-1' },
      source: { id: 'source-1' },
      runId: 7,
      suppressionRuntime: { backend: 'rnnoise' },
      createRnnoiseNodeFn: async () => ({}),
      createSpeexNodeFn: async () => ({}),
      createNoiseGateNodeFn: async () => ({}),
      createSpeechFocusChainFn: () => ({}),
      createKeyboardSuppressorNodeFn: async () => ({}),
      applyNoiseSuppressionRoutingFn: () => true,
      setTestDiagnosticsFn: () => {},
      addPerfPhaseFn: () => {},
      perfTraceId: 'trace-1',
      roundMsFn: (value) => value,
      warnFn: () => {},
      isUltraLowLatencyModeFn: () => false,
    },
  });

  assert.equal(graphInput.refs.testRunIdRef.current, 1);
  assert.equal(graphInput.deps.stream.id, 'stream-1');
  assert.equal(graphInput.deps.activeOutputId, 'speaker-1');
  assert.equal(graphInput.deps.perfTraceId, 'trace-1');
  assert.equal(warmupInput.refs.processingModeRef.current, 'standard');
  assert.equal(warmupInput.deps.ctx.id, 'ctx-1');
  assert.equal(warmupInput.deps.suppressionRuntime.backend, 'rnnoise');
});
