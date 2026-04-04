import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoiceProcessingModeChange,
  resolveVoiceProcessingModeChange,
  switchVoiceProcessingModeInPlace,
  toggleVoiceNoiseSuppression,
} from '../../../client/src/features/voice/voiceModeControlFlow.mjs';

test('voice mode control resolves ultra-low-latency mode through dependency helper', () => {
  const calls = [];

  const result = resolveVoiceProcessingModeChange({
    mode: 'ultra-low-latency',
    isUltraLowLatencyModeFn: (value) => value === 'ultra-low-latency',
    applyVoiceModeDependenciesFn: (value) => {
      calls.push(value);
      return { mode: value, noiseSuppression: false };
    },
  });

  assert.deepEqual(result, {
    mode: 'ultra-low-latency',
    noiseSuppression: false,
  });
  assert.deepEqual(calls, ['ultra-low-latency']);
});

test('voice mode control resolves standard mode through persistent standard defaults', () => {
  const calls = [];

  const result = resolveVoiceProcessingModeChange({
    mode: 'standard',
    persistVoiceProcessingModeFn: (value) => {
      calls.push(['mode', value]);
      return value;
    },
    persistNoiseSuppressionEnabledFn: (value) => {
      calls.push(['suppression', value]);
      return value;
    },
    isUltraLowLatencyModeFn: () => false,
  });

  assert.deepEqual(result, {
    mode: 'standard',
    noiseSuppression: true,
  });
  assert.deepEqual(calls, [
    ['mode', 'standard'],
    ['suppression', true],
  ]);
});

test('voice mode control applies an in-place routing switch and updates live diagnostics', () => {
  const tracePhases = [];
  let fallbackReason = null;
  let diagnostics = null;
  const pendingTraceRef = { current: 'trace-1' };

  const handled = switchVoiceProcessingModeInPlace({
    nextMode: 'standard',
    perfTraceId: 'trace-1',
    refs: {
      liveCaptureRef: { current: { id: 'capture-1' } },
      pendingVoiceModeSwitchTraceRef: pendingTraceRef,
    },
    updateVoiceDiagnosticsFn: (updater) => {
      diagnostics = updater({
        liveCapture: {
          filter: {
            existing: true,
          },
        },
      });
    },
    setLiveVoiceFallbackReasonFn: (value) => {
      fallbackReason = value;
    },
    addPerfPhaseFn: (traceId, phase, payload) => {
      tracePhases.push(['phase', traceId, phase, payload]);
    },
    endPerfTraceFn: (traceId, payload) => {
      tracePhases.push(['end', traceId, payload]);
    },
    switchVoiceCaptureRoutingModeFn: () => ({
      handled: true,
      wantsProcessedLane: true,
      usingProcessedLane: false,
      activeBackend: 'rnnoise',
      fallbackReason: 'helper unavailable',
    }),
    isUltraLowLatencyModeFn: () => false,
    applyNoiseSuppressionRoutingFn: () => true,
  });

  assert.equal(handled, true);
  assert.equal(fallbackReason, 'helper unavailable');
  assert.equal(pendingTraceRef.current, null);
  assert.equal(diagnostics.liveCapture.mode, 'standard');
  assert.deepEqual(diagnostics.liveCapture.filter, {
    existing: true,
    backend: 'rnnoise',
    suppressionEnabled: true,
    loaded: false,
    fallbackReason: 'helper unavailable',
  });
  assert.deepEqual(tracePhases, [
    ['phase', 'trace-1', 'routing-only', { backend: 'rnnoise', mode: 'standard' }],
    ['end', 'trace-1', {
      status: 'ready',
      strategy: 'routing-only',
      backend: 'rnnoise',
      mode: 'standard',
      fallbackReason: 'helper unavailable',
    }],
  ]);
});

test('voice mode control queues a reconfigure when routing-only switching cannot handle the change', () => {
  const calls = [];
  const refs = {
    channelIdRef: { current: 'channel-1' },
    voiceProcessingModeRef: { current: 'ultra-low-latency' },
    pendingVoiceModeSwitchTraceRef: { current: null },
    pendingLiveReconfigureRef: { current: 'timeout-1' },
  };

  const result = applyVoiceProcessingModeChange({
    mode: 'standard',
    perfSource: 'settings',
    uiTraceId: 'ui-1',
    refs,
    setVoiceProcessingModeStateFn: (value) => calls.push(['set-mode', value]),
    setLiveVoiceFallbackReasonFn: (value) => calls.push(['set-fallback', value]),
    startPerfTraceFn: (name, payload) => {
      calls.push(['start-trace', name, payload]);
      return 'trace-2';
    },
    cancelPerfTraceFn: () => {},
    addPerfPhaseFn: (traceId, phase, payload) => {
      calls.push(['phase', traceId, phase, payload]);
    },
    clearTimeoutFn: (timeoutId) => {
      calls.push(['clear-timeout', timeoutId]);
    },
    switchLiveCaptureModeInPlaceFn: () => false,
    applyNoiseSuppressionRoutingFn: (enabled) => {
      calls.push(['routing', enabled]);
    },
    scheduleLiveVoiceReconfigureFn: (traceId) => {
      calls.push(['schedule', traceId]);
    },
    persistVoiceProcessingModeFn: (value) => value,
    persistNoiseSuppressionEnabledFn: (value) => value,
    isUltraLowLatencyModeFn: () => false,
  });

  assert.deepEqual(result, {
    mode: 'standard',
    noiseSuppression: true,
  });
  assert.equal(refs.pendingLiveReconfigureRef.current, null);
  assert.equal(refs.pendingVoiceModeSwitchTraceRef.current, 'trace-2');
  assert.deepEqual(calls, [
    ['start-trace', 'voice-mode-switch-backend', {
      source: 'settings',
      uiTraceId: 'ui-1',
      channelId: 'channel-1',
      fromMode: 'ultra-low-latency',
      toMode: 'standard',
    }],
    ['phase', 'trace-2', 'requested', { noiseSuppressionEnabled: true }],
    ['set-mode', 'standard'],
    ['set-fallback', null],
    ['clear-timeout', 'timeout-1'],
    ['routing', true],
    ['schedule', 'trace-2'],
  ]);
});

test('voice mode control toggles between the two supported voice modes', () => {
  const calls = [];

  const result = toggleVoiceNoiseSuppression({
    enabled: false,
    setVoiceProcessingModeFn: (nextMode) => {
      calls.push(nextMode);
      return { noiseSuppression: false };
    },
  });

  assert.equal(result, false);
  assert.deepEqual(calls, ['ultra-low-latency']);
});
