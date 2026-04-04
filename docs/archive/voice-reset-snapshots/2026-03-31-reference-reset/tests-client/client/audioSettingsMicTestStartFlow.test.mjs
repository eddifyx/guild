import test from 'node:test';
import assert from 'node:assert/strict';

import { runAudioSettingsMicTestStart } from '../../../client/src/features/voice/audioSettingsMicTestStartFlow.mjs';

test('audio settings mic test start falls back from Apple cleanup without surfacing a red fallback reason', async () => {
  const refs = {
    processingModeRef: { current: 'standard' },
    selectedInputRef: { current: '' },
    selectedOutputRef: { current: '' },
    noiseSuppressionRef: { current: true },
    appleVoiceAvailableRef: { current: true },
    testRunIdRef: { current: 0 },
  };

  let diagnostics = null;
  const started = await runAudioSettingsMicTestStart({
    refs,
    outputDevices: [{ deviceId: 'default', label: 'Built-in Speakers' }],
    deps: {
      setTestStartingFn: () => {},
      clearPreviewPlaybackFn: () => {},
      setTestingFn: () => {},
      setTestDiagnosticsFn: (value) => {
        diagnostics = typeof value === 'function' ? value(diagnostics) : value;
      },
      voiceProcessingModes: { STANDARD: 'standard' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: null,
        hasExplicitSelection: false,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({ id: 'speaker-safe', gain: 0.36, label: 'Built-in Speakers' }),
      prefersAppleSystemVoiceIsolationFn: () => true,
      startPerfTraceFn: () => 'trace-1',
      addPerfPhaseFn: () => {},
      getNoiseSuppressionRuntimeStateFn: () => ({
        backend: 'apple-voice-processing',
        requiresWarmup: true,
      }),
      buildMicTestConstraintsFn: () => ({ audio: { deviceId: undefined } }),
      nowIsoFn: () => '2026-03-29T10:00:00.000Z',
      performanceNowFn: () => 10,
      voiceNoiseSuppressionBackends: {
        APPLE: 'apple-voice-processing',
      },
      startAppleVoiceIsolationTestFn: async () => {
        throw new Error('macOS Voice Isolation took too long to start.');
      },
      shouldDisableAppleVoiceForSessionFn: () => false,
      getFriendlyAppleVoiceFallbackMessageFn: () => 'Mac voice cleanup was not ready in time. Using standard cleanup instead.',
      warnFn: () => {},
      startAudioSettingsBrowserMicTestFn: async () => ({
        suppressionRuntime: { backend: 'rnnoise' },
        usedDefaultDeviceFallback: false,
        playbackState: 'live-playing',
      }),
      endPerfTraceFn: () => {},
      logErrorFn: () => {},
    },
  });

  assert.equal(started, true);
  assert.equal(diagnostics?.filter?.fallbackReason, null);
});

test('audio settings mic test start clears loading when the start-state build throws before runtime start', async () => {
  const calls = [];

  const started = await runAudioSettingsMicTestStart({
    refs: {},
    outputDevices: [],
    deps: {
      setTestStartingFn: (value) => calls.push(['starting', value]),
      clearPreviewPlaybackFn: () => calls.push(['clear-preview']),
      getPlatformFn: () => {
        throw new Error('platform unavailable');
      },
      logErrorFn: (...args) => calls.push(['error', args[0]]),
    },
  });

  assert.equal(started, false);
  assert.equal(calls.some((entry) => entry[0] === 'starting' && entry[1] === false), true);
});

test('audio settings mic test start clears loading when browser startup aborts without throwing', async () => {
  const calls = [];

  const started = await runAudioSettingsMicTestStart({
    refs: {
      processingModeRef: { current: 'standard' },
      selectedInputRef: { current: '' },
      selectedOutputRef: { current: '' },
      noiseSuppressionRef: { current: true },
      appleVoiceAvailableRef: { current: false },
      testRunIdRef: { current: 0 },
    },
    outputDevices: [{ deviceId: 'default', label: 'Built-in Speakers' }],
    deps: {
      setTestStartingFn: (value) => calls.push(['starting', value]),
      clearPreviewPlaybackFn: () => {},
      setTestingFn: (value) => calls.push(['testing', value]),
      setTestDiagnosticsFn: () => {},
      voiceProcessingModes: { STANDARD: 'standard' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: null,
        hasExplicitSelection: false,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({ id: 'speaker-safe', gain: 0.36, label: 'Built-in Speakers' }),
      prefersAppleSystemVoiceIsolationFn: () => false,
      startPerfTraceFn: () => 'trace-1',
      addPerfPhaseFn: () => {},
      getNoiseSuppressionRuntimeStateFn: () => ({
        backend: 'rnnoise',
        requiresWarmup: true,
      }),
      buildMicTestConstraintsFn: () => ({ audio: { deviceId: undefined } }),
      nowIsoFn: () => '2026-03-31T12:00:00.000Z',
      performanceNowFn: () => 10,
      voiceNoiseSuppressionBackends: {
        APPLE: 'apple-voice-processing',
      },
      startAudioSettingsBrowserMicTestFn: async () => null,
      endPerfTraceFn: () => {},
      logErrorFn: () => {},
    },
  });

  assert.equal(started, false);
  assert.deepEqual(calls, [
    ['starting', true],
    ['testing', true],
    ['starting', false],
    ['testing', false],
  ]);
});
