import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceLiveCaptureBindings } from '../../../client/src/features/voice/voiceLiveCaptureBindings.mjs';

test('voice live capture bindings clear probes and delegate routing/ref sync under one lane context', async () => {
  const calls = [];
  const refs = {
    voiceHealthProbeTimeoutRef: { current: 'timeout-1' },
    liveCaptureRef: { current: { id: 'capture-1' } },
    pendingVoiceModeSwitchTraceRef: { current: 'trace-1' },
    localStreamRef: { current: { id: 'stream-1' } },
    micAudioCtxRef: { current: { id: 'audio-ctx' } },
    micGainNodeRef: { current: { id: 'gain' } },
    noiseSuppressorNodeRef: { current: { id: 'ns' } },
    residualDenoiserNodeRef: { current: { id: 'rd' } },
    noiseGateNodeRef: { current: { id: 'ng' } },
    speechFocusChainRef: { current: { id: 'sf' } },
    keyboardSuppressorNodeRef: { current: { id: 'kb' } },
    noiseSuppressionRoutingRef: { current: { id: 'routing' } },
    appleVoiceFrameCleanupRef: { current: { id: 'frame' } },
    appleVoiceStateCleanupRef: { current: { id: 'state' } },
    appleVoiceSourceNodeRef: { current: { id: 'source' } },
    appleVoiceAvailableRef: { current: true },
  };

  const bindings = createVoiceLiveCaptureBindings({
    refs,
    setters: {
      setLiveVoiceFallbackReasonFn: (value) => calls.push(['setFallback', value]),
    },
    runtime: {
      clearTimeoutFn: (timeoutId) => calls.push(['clearTimeout', timeoutId]),
      updateVoiceDiagnosticsFn: (updater) => calls.push(['updateDiagnostics', typeof updater]),
      addPerfPhaseFn: (...args) => calls.push(['addPerfPhase', ...args]),
      endPerfTraceFn: (...args) => calls.push(['endPerfTrace', ...args]),
      switchVoiceCaptureRoutingModeFn: (...args) => calls.push(['switchRoutingMode', ...args]),
      isUltraLowLatencyModeFn: (mode) => mode === 'ultra-low-latency',
      applyNoiseSuppressionRoutingFn: (...args) => calls.push(['applyNoiseSuppressionRouting', ...args]),
      stopAppleVoiceCaptureFn: (...args) => calls.push(['stopAppleVoiceCapture', ...args]),
      getStoredVoiceProcessingModeFn: () => 'ultra-low-latency',
      startAppleVoiceCaptureFn: (...args) => calls.push(['startAppleVoiceCapture', ...args]),
      isAppleVoiceCaptureSupportedFn: async () => true,
      onAppleVoiceCaptureFrameFn: (...args) => calls.push(['onAppleFrame', ...args]),
      onAppleVoiceCaptureStateFn: (...args) => calls.push(['onAppleState', ...args]),
      audioContextCtor: class FakeAudioContext {},
      performanceNowFn: () => 456,
      nowIsoFn: () => '2026-03-25T00:00:00.000Z',
      roundMsFn: (value) => value,
      summarizeTrackSnapshotFn: (value) => value,
      warnFn: (...args) => calls.push(['warn', ...args]),
    },
    constants: {
      voiceSafeMode: true,
      voiceEmergencyDirectSourceTrack: true,
      forceFreshRawMicCapture: true,
      appleVoiceCaptureOwner: 'live-voice',
      appleVoiceLiveStartTimeoutMs: 3200,
      rnnoiseSendMakeupGain: 2.4,
    },
    deps: {
      switchVoiceProcessingModeInPlaceFn: (payload) => {
        calls.push(['switchMode', payload]);
        return { handled: true };
      },
      syncVoiceLiveCaptureRefsFn: (allRefs, capture) => {
        calls.push(['syncRefs', allRefs, capture]);
      },
      disposeVoiceLiveCaptureFn: async (capture, payload) => {
        calls.push(['disposeCapture', capture, payload]);
      },
      createVoiceLiveMicCaptureFn: async (payload) => {
        calls.push(['createCapture', payload]);
        return { captureId: 'capture-2' };
      },
    },
  });

  bindings.clearVoiceHealthProbe();
  const switchResult = bindings.switchLiveCaptureModeInPlace('ultra-low-latency', {
    perfTraceId: 'trace-2',
  });
  bindings.syncLiveCaptureRefs({ id: 'capture-2' });
  await bindings.disposeLiveCapture({ id: 'capture-3' }, { releaseOwner: false });
  const capture = await bindings.createLiveMicCapture({ chId: 'channel-1' });

  assert.deepEqual(switchResult, { handled: true });
  assert.equal(refs.voiceHealthProbeTimeoutRef.current, null);
  assert.equal(calls[0][0], 'clearTimeout');
  assert.equal(calls[1][0], 'switchMode');
  assert.equal(calls[1][1].nextMode, 'ultra-low-latency');
  assert.equal(calls[2][0], 'syncRefs');
  assert.equal(calls[3][0], 'disposeCapture');
  assert.equal(calls[4][0], 'createCapture');
  assert.equal(calls[4][1].deps.appleVoiceCaptureOwner, 'live-voice');
  assert.equal(capture.captureId, 'capture-2');
});
