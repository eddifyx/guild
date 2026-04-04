import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsInputChangeHandlerOptions,
  buildAudioSettingsOutputChangeHandlerOptions,
  buildAudioSettingsOutputChangeOptions,
  buildAudioSettingsOutputRuntime,
  buildAudioSettingsProcessingModeChangeOptions,
  buildAudioSettingsProcessingModeHandlerOptions,
  buildAudioSettingsProcessingModeRuntime,
  buildAudioSettingsRestartTestHandlerOptions,
  buildUseAudioSettingsRuntimeEffectsDeps,
  buildUseAudioSettingsRuntimeEffectsOptions,
} from '../../../client/src/features/voice/audioSettingsControllerOptionBuilders.mjs';

test('audio settings option builders keep runtime-effects state and deps stable', () => {
  const refs = { selectedInputRef: { current: 'mic-1' } };
  const state = { selectedInput: 'mic-1', testing: true };
  const deps = buildUseAudioSettingsRuntimeEffectsDeps({
    restartTestFn: () => {},
    stopTestFn: () => {},
    updateMicMeterFn: () => {},
  });

  const options = buildUseAudioSettingsRuntimeEffectsOptions({ state, refs, deps });

  assert.equal(options.refs, refs);
  assert.equal(options.state, state);
  assert.equal(options.deps, deps);
  assert.equal(options.selectedInput, 'mic-1');
  assert.equal(options.testing, true);
});

test('audio settings option builders preserve restart and output contracts', () => {
  const restartOptions = buildAudioSettingsRestartTestHandlerOptions({
    testing: true,
    stopTestFn: () => {},
    startTestFn: () => {},
    restartAudioSettingsMicTestFn: () => {},
  });
  const outputRuntime = buildAudioSettingsOutputRuntime({
    selectOutputFn: () => {},
    setOutputDeviceFn: () => {},
    restartTestFn: () => {},
    resolveOutputSelectionFn: () => ({}),
    getMonitorProfileFn: () => 'direct',
    setTestDiagnosticsFn: () => {},
  });
  const outputOptions = buildAudioSettingsOutputChangeOptions({
    deviceId: 'speaker-2',
    refs: { outputRef: { current: null } },
    outputDevices: [{ deviceId: 'speaker-2' }],
    runtime: outputRuntime,
  });
  const outputHandlerOptions = buildAudioSettingsOutputChangeHandlerOptions({
    refs: { outputRef: { current: null } },
    outputDevices: [{ deviceId: 'speaker-2' }],
    runtime: outputRuntime,
  });

  assert.equal(restartOptions.testing, true);
  assert.equal(typeof restartOptions.restartAudioSettingsMicTestFn, 'function');
  assert.equal(outputOptions.deviceId, 'speaker-2');
  assert.equal(typeof outputOptions.restartTestFn, 'function');
  assert.equal(outputHandlerOptions.outputDevices.length, 1);
  assert.equal(typeof outputHandlerOptions.runtime.restartTestFn, 'function');
});

test('audio settings option builders preserve input and processing contracts', () => {
  const inputOptions = buildAudioSettingsInputChangeHandlerOptions({
    selectedInputRef: { current: 'mic-1' },
    selectInputFn: () => {},
    restartTestFn: () => {},
  });
  const processingRuntime = buildAudioSettingsProcessingModeRuntime({
    setVoiceProcessingModeFn: () => {},
    setProcessingModeStateFn: () => {},
    setNoiseSuppressionStateFn: () => {},
    restartTestFn: () => {},
    startPerfTraceFn: () => {},
    addPerfPhaseFn: () => {},
    endPerfTraceAfterNextPaintFn: () => {},
    isUltraLowLatencyModeFn: () => true,
    voiceProcessingModes: ['standard'],
  });
  const processingOptions = buildAudioSettingsProcessingModeChangeOptions({
    nextMode: 'ultra-low-latency',
    testing: true,
    refs: { processingModeRef: { current: 'standard' } },
    runtime: processingRuntime,
  });
  const processingHandlerOptions = buildAudioSettingsProcessingModeHandlerOptions({
    testing: true,
    refs: { processingModeRef: { current: 'standard' } },
    runtime: processingRuntime,
  });

  assert.equal(inputOptions.selectedInputRef.current, 'mic-1');
  assert.equal(typeof inputOptions.restartTestFn, 'function');
  assert.equal(processingOptions.nextMode, 'ultra-low-latency');
  assert.equal(processingOptions.testing, true);
  assert.equal(typeof processingOptions.restartTestFn, 'function');
  assert.equal(processingHandlerOptions.testing, true);
  assert.equal(typeof processingHandlerOptions.runtime.restartTestFn, 'function');
});
