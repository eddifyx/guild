import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAudioSettingsBrowserMicTestInput } from '../../../client/src/features/voice/audioSettingsBrowserMicTestInput.mjs';

test('audio settings browser mic test input builder preserves runtime and ref contracts', () => {
  const onUsedDefaultDeviceFallbackChangeFn = () => {};
  const attachMonitorOutputFn = () => {};
  const refs = {
    testRunIdRef: { current: 1 },
    streamRef: { current: null },
    audioCtxRef: { current: null },
    gainRef: { current: null },
    noiseSuppressionRoutingRef: { current: null },
    animFrameRef: { current: null },
    processingModeRef: { current: 'standard' },
    noiseSuppressionRef: { current: true },
    noiseSuppressorNodeRef: { current: null },
    residualDenoiserNodeRef: { current: null },
    noiseGateNodeRef: { current: null },
    speechFocusChainRef: { current: null },
    keyboardSuppressorNodeRef: { current: null },
    selectedOutputRef: { current: 'speaker-1' },
  };

  const input = buildAudioSettingsBrowserMicTestInput({
    refs,
    deps: {
      attachMonitorOutputFn,
      updateMicMeterFn: () => {},
      applyNoiseSuppressionRoutingFn: () => true,
      setTestingFn: () => {},
      setTestStartingFn: () => {},
      setTestDiagnosticsFn: () => {},
      addPerfPhaseFn: () => {},
      performanceNowFn: () => 123,
      roundMsFn: (value) => value,
      warnFn: () => {},
    },
    state: {
      activeVoiceMode: 'standard',
      activeInputId: 'mic-1',
      activeOutputId: 'speaker-1',
      monitorProfile: { id: 'studio' },
      outputSelection: { usedDefaultFallback: false },
      noiseSuppressionEnabled: true,
      useRawMicPath: false,
      requestedSuppressionRuntime: { backend: 'rnnoise' },
      initialConstraints: { audio: { deviceId: 'mic-1' } },
      fallbackConstraints: { audio: true },
    },
    runtime: {
      runId: 3,
      testStart: 100,
      testStartedAt: '2026-03-26T12:00:00.000Z',
      perfTraceId: 'trace-1',
      preferDirectBrowserFallback: true,
      onUsedDefaultDeviceFallbackChangeFn,
    },
  });

  assert.equal(input.refs.testRunIdRef, refs.testRunIdRef);
  assert.equal(input.refs.processingModeRef, refs.processingModeRef);
  assert.equal(input.deps.activeInputId, 'mic-1');
  assert.equal(input.deps.activeOutputId, 'speaker-1');
  assert.equal(input.deps.requestedOutputDeviceId, 'speaker-1');
  assert.equal(input.deps.preferDirectBrowserFallback, true);
  assert.equal(input.deps.runId, 3);
  assert.equal(input.deps.perfTraceId, 'trace-1');
  assert.equal(input.deps.onUsedDefaultDeviceFallbackChangeFn, onUsedDefaultDeviceFallbackChangeFn);
  assert.equal(input.deps.attachMonitorOutputFn, attachMonitorOutputFn);
});
