import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsAppleIsolationDeps,
  buildAudioSettingsAppleIsolationHandlerOptions,
  buildAudioSettingsAttachMonitorOutputHandlerOptions,
  buildAudioSettingsAttachMonitorHandlerDeps,
  buildAudioSettingsAppleIsolationOptions,
  buildAudioSettingsInputChangeHandlerOptions,
  buildAudioSettingsMicTestDeps,
  buildAudioSettingsMicTestStartHandlerOptions,
  buildAudioSettingsMicTestStartOptions,
  buildAudioSettingsMonitorOutputOptions,
  buildAudioSettingsOutputRuntime,
  buildAudioSettingsOutputChangeHandlerOptions,
  buildAudioSettingsRestartTestHandlerOptions,
  buildAudioSettingsOutputChangeOptions,
  buildAudioSettingsProcessingModeRuntime,
  buildAudioSettingsProcessingModeHandlerOptions,
  buildAudioSettingsProcessingModeChangeOptions,
  buildAudioSettingsStopTestHandlerOptions,
  buildAudioSettingsStopTestOptions,
  buildUseAudioSettingsRuntimeEffectsDeps,
  buildUseAudioSettingsRuntimeEffectsOptions,
} from '../../../client/src/features/voice/audioSettingsControllerBindings.mjs';

test('audio settings controller bindings build canonical monitor-output options', () => {
  const refs = {
    monitorGainRef: { current: null },
  };
  const runtime = {
    clearPreviewPlaybackFn: () => {},
  };

  const options = buildAudioSettingsMonitorOutputOptions({
    ctx: { id: 'ctx-1' },
    gainNode: { id: 'gain-1' },
    activeOutputId: 'output-1',
    monitorProfile: 'direct',
    preferDirectMonitor: true,
    refs,
    runtime,
  });

  assert.equal(options.activeOutputId, 'output-1');
  assert.equal(options.monitorProfile, 'direct');
  assert.equal(options.preferDirectMonitor, true);
  assert.equal(options.refs, refs);
  assert.equal(options.runtime, runtime);
});

test('audio settings controller bindings keep stop-test and apple-test option bags stable', () => {
  const refs = { testRunIdRef: { current: 3 } };
  const deps = { setTestingFn: () => {} };

  const stopOptions = buildAudioSettingsStopTestOptions({ refs, deps });
  const appleOptions = buildAudioSettingsAppleIsolationOptions({ refs, deps });

  assert.equal(stopOptions.refs, refs);
  assert.equal(stopOptions.deps, deps);
  assert.equal(appleOptions.refs, refs);
  assert.equal(appleOptions.deps, deps);
});

test('audio settings controller bindings build handler option contracts for preview, stop, and apple isolation flows', () => {
  const refs = { testRunIdRef: { current: 3 } };
  const attachDeps = buildAudioSettingsAttachMonitorHandlerDeps({
    attachAudioSettingsMonitorOutputFn: () => {},
    performanceNowFn: () => 1,
    audioCtor: class {},
    setTimeoutFn: () => {},
    haveMetadataReadyState: 1,
  });
  const attachOptions = buildAudioSettingsAttachMonitorOutputHandlerOptions({
    monitorGainRef: { current: { id: 'gain' } },
    previewAudioRef: { current: { id: 'preview' } },
    clearPreviewPlaybackFn: () => {},
    ...attachDeps,
  });
  const appleDeps = buildAudioSettingsAppleIsolationDeps({
    createApplePcmBridgeNodeFn: () => {},
    getFriendlyAppleVoiceFallbackMessageFn: () => 'fallback',
    normalizeElectronBinaryChunkFn: () => new Float32Array(),
    startAppleVoiceCaptureFn: () => {},
    stopAppleVoiceCaptureFn: () => {},
    isAppleVoiceCaptureSupportedFn: () => true,
    onAppleVoiceCaptureFrameFn: () => () => {},
    onAppleVoiceCaptureStateFn: () => () => {},
    getVoiceAudioContextOptionsFn: () => ({}),
    performanceNowFn: () => 2,
    roundMsFn: (value) => value,
    requestAnimationFrameFn: () => 1,
  });
  const stopHandlerOptions = buildAudioSettingsStopTestHandlerOptions({
    refs,
    deps: { stopAppleVoiceCaptureFn: () => {} },
    clearPreviewPlaybackFn: () => {},
    updateMicMeterFn: () => {},
    setTestStartingFn: () => {},
    setTestingFn: () => {},
    setTestDiagnosticsFn: () => {},
  });
  const appleHandlerOptions = buildAudioSettingsAppleIsolationHandlerOptions({
    refs,
    deps: appleDeps,
    updateMicMeterFn: () => {},
    setTestDiagnosticsFn: () => {},
    setTestingFn: () => {},
    setTestStartingFn: () => {},
    attachMonitorOutputFn: () => {},
  });

  assert.equal(typeof attachOptions.clearPreviewPlaybackFn, 'function');
  assert.equal(attachOptions.haveMetadataReadyState, 1);
  assert.equal(typeof attachDeps.attachAudioSettingsMonitorOutputFn, 'function');
  assert.equal(stopHandlerOptions.refs, refs);
  assert.equal(typeof stopHandlerOptions.setTestDiagnosticsFn, 'function');
  assert.equal(appleHandlerOptions.refs, refs);
  assert.equal(typeof appleHandlerOptions.attachMonitorOutputFn, 'function');
  assert.equal(typeof appleDeps.createApplePcmBridgeNodeFn, 'function');
});

test('audio settings controller bindings keep mic-test start options stable', () => {
  const refs = { processingModeRef: { current: 'standard' } };
  const deps = { setTestingFn: () => {} };

  const options = buildAudioSettingsMicTestStartOptions({
    refs,
    outputDevices: [{ deviceId: 'default' }],
    deps,
  });

  assert.equal(options.refs, refs);
  assert.equal(options.deps, deps);
  assert.deepEqual(options.outputDevices, [{ deviceId: 'default' }]);
});

test('audio settings controller bindings build mic-test start and restart handler contracts', () => {
  const refs = { processingModeRef: { current: 'standard' } };
  const micDeps = buildAudioSettingsMicTestDeps({
    getUserMediaFn: async () => null,
    voiceProcessingModes: ['standard'],
    resolveOutputSelectionFn: () => ({}),
    getMonitorProfileFn: () => 'direct',
  });
  const startHandlerOptions = buildAudioSettingsMicTestStartHandlerOptions({
    refs,
    outputDevices: [{ deviceId: 'default' }],
    deps: micDeps,
    setTestStartingFn: () => {},
    setTestingFn: () => {},
    setTestDiagnosticsFn: () => {},
    clearPreviewPlaybackFn: () => {},
    attachMonitorOutputFn: () => {},
    updateMicMeterFn: () => {},
    applyNoiseSuppressionRoutingFn: () => {},
    startAppleVoiceIsolationTestFn: () => {},
  });
  const restartOptions = buildAudioSettingsRestartTestHandlerOptions({
    testing: true,
    stopTestFn: () => {},
    startTestFn: () => {},
    restartAudioSettingsMicTestFn: () => {},
  });

  assert.equal(startHandlerOptions.refs, refs);
  assert.equal(typeof startHandlerOptions.startAppleVoiceIsolationTestFn, 'function');
  assert.equal(typeof micDeps.getUserMediaFn, 'function');
  assert.equal(restartOptions.testing, true);
  assert.equal(typeof restartOptions.restartAudioSettingsMicTestFn, 'function');
});

test('audio settings controller bindings build runtime-effects options with passthrough state', () => {
  const refs = { selectedInputRef: { current: 'mic-1' } };
  const state = {
    selectedInput: 'mic-1',
    testing: true,
  };
  const deps = buildUseAudioSettingsRuntimeEffectsDeps({
    restartTestFn: () => {},
  });

  const options = buildUseAudioSettingsRuntimeEffectsOptions({
    state,
    refs,
    deps,
  });

  assert.equal(options.refs, refs);
  assert.equal(options.state, state);
  assert.equal(options.deps, deps);
  assert.equal(options.selectedInput, 'mic-1');
  assert.equal(options.testing, true);
});

test('audio settings controller bindings build canonical output and processing action options', () => {
  const refs = { processingModeRef: { current: 'standard' } };
  const outputRuntime = buildAudioSettingsOutputRuntime({
    restartTestFn: () => {},
  });
  const outputOptions = buildAudioSettingsOutputChangeOptions({
    deviceId: 'speaker-2',
    refs,
    outputDevices: [{ deviceId: 'speaker-2' }],
    runtime: outputRuntime,
  });
  const modeRuntime = buildAudioSettingsProcessingModeRuntime({
    restartTestFn: () => {},
  });
  const modeOptions = buildAudioSettingsProcessingModeChangeOptions({
    nextMode: 'ultra-low-latency',
    testing: true,
    refs,
    runtime: modeRuntime,
  });

  assert.equal(outputOptions.deviceId, 'speaker-2');
  assert.equal(outputOptions.refs, refs);
  assert.equal(typeof outputOptions.restartTestFn, 'function');
  assert.equal(modeOptions.nextMode, 'ultra-low-latency');
  assert.equal(modeOptions.testing, true);
  assert.equal(modeOptions.refs, refs);
  assert.equal(typeof modeOptions.restartTestFn, 'function');
  assert.equal(typeof outputRuntime.restartTestFn, 'function');
  assert.equal(typeof modeRuntime.restartTestFn, 'function');
});

test('audio settings controller bindings build handler contracts for output, input, and processing interactions', () => {
  const refs = { processingModeRef: { current: 'standard' } };
  const outputRuntime = buildAudioSettingsOutputRuntime({
    restartTestFn: () => {},
  });
  const outputHandlerOptions = buildAudioSettingsOutputChangeHandlerOptions({
    refs,
    outputDevices: [{ deviceId: 'speaker-2' }],
    runtime: outputRuntime,
  });
  const processingRuntime = buildAudioSettingsProcessingModeRuntime({
    restartTestFn: () => {},
  });
  const inputHandlerOptions = buildAudioSettingsInputChangeHandlerOptions({
    selectedInputRef: { current: 'mic-1' },
    selectInputFn: () => {},
    restartTestFn: () => {},
  });
  const processingHandlerOptions = buildAudioSettingsProcessingModeHandlerOptions({
    testing: true,
    refs,
    runtime: processingRuntime,
  });

  assert.equal(outputHandlerOptions.refs, refs);
  assert.equal(typeof outputHandlerOptions.runtime.restartTestFn, 'function');
  assert.equal(inputHandlerOptions.selectedInputRef.current, 'mic-1');
  assert.equal(typeof inputHandlerOptions.restartTestFn, 'function');
  assert.equal(processingHandlerOptions.testing, true);
  assert.equal(processingHandlerOptions.refs, refs);
  assert.equal(typeof processingRuntime.restartTestFn, 'function');
});
