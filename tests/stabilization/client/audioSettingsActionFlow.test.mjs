import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAudioSettingsOutputChange,
  applyAudioSettingsProcessingModeChange,
  closeAudioSettings,
  restartAudioSettingsMicTest,
  runAudioSettingsMicTestStart,
} from '../../../client/src/features/voice/audioSettingsActionFlow.mjs';

test('audio settings action flow updates output selection, preview routing, and diagnostics together', async () => {
  let selectedOutput = null;
  let outputDevice = null;
  let restartCount = 0;
  let diagnostics = {
    playback: {
      state: 'live-playing',
    },
  };

  const refs = {
    skipSelectedOutputSyncRestartRef: { current: false },
    selectedOutputRef: { current: null },
    previewAudioRef: {
      current: {
        setSinkId: async (deviceId) => {
          outputDevice = `${deviceId}:preview`;
        },
      },
    },
    monitorGainRef: {
      current: {
        gain: { value: 0 },
      },
    },
  };

  const { outputSelection, monitorProfile } = applyAudioSettingsOutputChange({
    deviceId: 'speaker-1',
    refs,
    outputDevices: [{ deviceId: 'speaker-1', label: 'Studio Speakers' }],
    selectOutputFn: (deviceId) => {
      selectedOutput = deviceId;
    },
    setOutputDeviceFn: (deviceId) => {
      outputDevice = deviceId;
    },
    restartTestFn: () => {
      restartCount += 1;
    },
    resolveOutputSelectionFn: () => ({
      activeOutputId: 'speaker-1',
      hasExplicitSelection: true,
      usedDefaultFallback: false,
    }),
    getMonitorProfileFn: () => ({
      id: 'studio',
      label: 'Studio Speakers',
      gain: 0.55,
    }),
    setTestDiagnosticsFn: (value) => {
      diagnostics = typeof value === 'function' ? value(diagnostics) : value;
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(refs.skipSelectedOutputSyncRestartRef.current, true);
  assert.equal(refs.selectedOutputRef.current, 'speaker-1');
  assert.equal(selectedOutput, 'speaker-1');
  assert.equal(outputDevice, 'speaker-1:preview');
  assert.equal(refs.monitorGainRef.current.gain.value, 0.55);
  assert.equal(restartCount, 1);
  assert.equal(outputSelection.activeOutputId, 'speaker-1');
  assert.equal(monitorProfile.id, 'studio');
  assert.equal(diagnostics.playback.outputDeviceId, 'speaker-1');
  assert.equal(diagnostics.playback.monitorProfile, 'studio');
});

test('audio settings action flow applies processing mode changes through the shared state path', () => {
  const refs = {
    processingModeRef: { current: 'standard' },
    noiseSuppressionRef: { current: true },
  };
  const state = {
    processingMode: null,
    noiseSuppression: null,
    restartCount: 0,
  };

  const nextState = applyAudioSettingsProcessingModeChange({
    nextMode: 'ultra-low-latency',
    testing: true,
    refs,
    setVoiceProcessingModeFn: (mode) => ({
      mode,
      noiseSuppression: false,
    }),
    setProcessingModeStateFn: (value) => {
      state.processingMode = value;
    },
    setNoiseSuppressionStateFn: (value) => {
      state.noiseSuppression = value;
    },
    restartTestFn: () => {
      state.restartCount += 1;
    },
    startPerfTraceFn: () => 'trace-1',
    addPerfPhaseFn: () => {},
    endPerfTraceAfterNextPaintFn: () => {},
    isUltraLowLatencyModeFn: (mode) => mode === 'ultra-low-latency',
    voiceProcessingModes: {
      ULTRA_LOW_LATENCY: 'ultra-low-latency',
    },
  });

  assert.equal(nextState.mode, 'ultra-low-latency');
  assert.equal(refs.processingModeRef.current, 'ultra-low-latency');
  assert.equal(refs.noiseSuppressionRef.current, false);
  assert.equal(state.processingMode, 'ultra-low-latency');
  assert.equal(state.noiseSuppression, false);
  assert.equal(state.restartCount, 1);
});

test('audio settings action flow keeps darwin standard mic tests on the browser lane even when Apple hardware cleanup is available', async () => {
  let browserStarted = false;
  let diagnostics = null;
  const perfTraceCalls = [];

  const started = await runAudioSettingsMicTestStart({
    refs: {
      processingModeRef: { current: 'standard' },
      selectedInputRef: { current: '' },
      selectedOutputRef: { current: 'speaker-1' },
      noiseSuppressionRef: { current: true },
      appleVoiceAvailableRef: { current: true },
      testRunIdRef: { current: 0 },
    },
    outputDevices: [{ deviceId: 'speaker-1', label: 'Studio Speakers' }],
    deps: {
      setTestStartingFn: () => {},
      clearPreviewPlaybackFn: () => {},
      voiceProcessingModes: { STANDARD: 'standard' },
      isUltraLowLatencyModeFn: () => false,
      resolveOutputSelectionFn: () => ({
        activeOutputId: 'speaker-1',
        hasExplicitSelection: true,
        usedDefaultFallback: false,
      }),
      getMonitorProfileFn: () => ({
        id: 'studio',
        label: 'Studio Speakers',
        gain: 0.55,
      }),
      prefersAppleSystemVoiceIsolationFn: () => true,
      startPerfTraceFn: () => 'trace-apple',
      addPerfPhaseFn: (...args) => perfTraceCalls.push(args),
      getNoiseSuppressionRuntimeStateFn: ({ noiseSuppressionBackend }) => ({
        backend: noiseSuppressionBackend || 'rnnoise',
        requiresWarmup: true,
      }),
      referenceVoiceLane: false,
      buildMicTestConstraintsFn: () => ({ audio: { deviceId: 'default' } }),
      nowIsoFn: () => '2026-03-25T00:00:00.000Z',
      performanceNowFn: () => 123,
      setTestingFn: () => {},
      setTestDiagnosticsFn: (value) => {
        diagnostics = typeof value === 'function' ? value(diagnostics) : value;
      },
      voiceNoiseSuppressionBackends: { APPLE: 'apple-voice-processing', WEBRTC_APM: 'webrtc-apm' },
      startAppleVoiceIsolationTestFn: async () => {
        throw new Error('Apple mic test path should stay disabled here');
      },
      shouldDisableAppleVoiceForSessionFn: () => false,
      getFriendlyAppleVoiceFallbackMessageFn: () => null,
      warnFn: () => {},
      endPerfTraceFn: (...args) => perfTraceCalls.push(['end', ...args]),
      startAudioSettingsBrowserMicTestFn: async () => {
        browserStarted = true;
        return {
          suppressionRuntime: { backend: 'webrtc-apm' },
          playbackState: 'live-playing',
          usedDefaultDeviceFallback: false,
        };
      },
    },
  });

  assert.equal(started, true);
  assert.equal(browserStarted, true);
  assert.equal(diagnostics.filter.backend, 'rnnoise');
  assert.equal(perfTraceCalls.at(-1)[0], 'end');
});

test('audio settings action flow restarts only while testing and closes through stop-then-close ordering', async () => {
  const callOrder = [];

  assert.equal(restartAudioSettingsMicTest({
    testing: false,
    stopTestFn: async () => {
      callOrder.push('stop');
    },
    startTestFn: async () => {
      callOrder.push('start');
    },
  }), false);

  assert.equal(restartAudioSettingsMicTest({
    testing: true,
    stopTestFn: async () => {
      callOrder.push('stop');
    },
    startTestFn: async () => {
      callOrder.push('start');
    },
  }), true);

  await new Promise((resolve) => setTimeout(resolve, 0));

  await closeAudioSettings({
    stopTestFn: async () => {
      callOrder.push('stop-close');
    },
    onCloseFn: () => {
      callOrder.push('close');
    },
  });

  assert.deepEqual(callOrder, ['stop', 'start', 'stop-close', 'close']);
});
