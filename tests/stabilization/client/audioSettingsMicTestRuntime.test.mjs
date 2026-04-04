import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAudioSettingsAppleIsolationHandler,
  createAudioSettingsAttachMonitorOutputHandler,
  createAudioSettingsClearPreviewPlaybackHandler,
  createAudioSettingsCloseHandler,
  createAudioSettingsRestartTestHandler,
  createAudioSettingsStartTestHandler,
  createAudioSettingsStopTestHandler,
} from '../../../client/src/features/voice/audioSettingsMicTestRuntime.mjs';

test('audio settings mic test runtime clears preview playback through the shared preview helper', () => {
  const calls = [];
  const previewAudioRef = { current: { id: 'preview' } };

  const clearPreviewPlayback = createAudioSettingsClearPreviewPlaybackHandler({
    previewAudioRef,
    clearAudioSettingsPreviewPlaybackFn: (ref) => calls.push(ref.current.id),
  });

  clearPreviewPlayback();
  assert.deepEqual(calls, ['preview']);
});

test('audio settings mic test runtime attaches monitor output with canonical runtime dependencies', async () => {
  let receivedOptions = null;

  const attachMonitorOutput = createAudioSettingsAttachMonitorOutputHandler({
    monitorGainRef: { current: { id: 'monitor-gain' } },
    previewAudioRef: { current: { id: 'preview-audio' } },
    clearPreviewPlaybackFn: () => {},
    attachAudioSettingsMonitorOutputFn: async (options) => {
      receivedOptions = options;
      return 'attached';
    },
    ensureVoiceAudioHostFn: () => ({ id: 'voice-audio-host' }),
    performanceNowFn: () => 123,
    audioCtor: function TestAudio() {},
    setTimeoutFn: () => {},
    haveMetadataReadyState: 4,
  });

  const result = await attachMonitorOutput({
    ctx: 'ctx',
    gainNode: 'gain',
    activeOutputId: 'speaker-1',
    monitorProfile: { id: 'profile-1' },
    preferDirectMonitor: true,
  });

  assert.equal(result, 'attached');
  assert.equal(receivedOptions.activeOutputId, 'speaker-1');
  assert.equal(receivedOptions.refs.monitorGainRef.current.id, 'monitor-gain');
  assert.equal(receivedOptions.refs.previewAudioRef.current.id, 'preview-audio');
  assert.equal(receivedOptions.runtime.ensureVoiceAudioHostFn().id, 'voice-audio-host');
  assert.equal(receivedOptions.runtime.performanceNowFn(), 123);
  assert.equal(receivedOptions.runtime.haveMetadataReadyState, 4);
  assert.equal(receivedOptions.runtime.preferPreviewMonitorOnDefault, true);
});

test('audio settings mic test runtime builds stop and start handlers through the shared option builders', async () => {
  const calls = [];
  const refs = { testRunIdRef: { current: 9 } };

  const stopTest = createAudioSettingsStopTestHandler({
    refs,
    clearPreviewPlaybackFn: () => calls.push('clear-preview'),
    updateMicMeterFn: () => calls.push('update-meter'),
    setTestStartingFn: () => calls.push('set-starting'),
    setTestingFn: () => calls.push('set-testing'),
    setTestDiagnosticsFn: () => calls.push('set-diagnostics'),
    stopAudioSettingsTestRuntimeFn: async (options) => {
      calls.push(['stop', options.refs.testRunIdRef.current, options.deps.appleVoiceCaptureOwner]);
    },
    cancelAnimationFrameFn: () => {},
    stopAppleVoiceCaptureFn: () => {},
  });

  const startTest = createAudioSettingsStartTestHandler({
    refs,
    outputDevices: [{ deviceId: 'speaker-1' }],
    deps: {
      getUserMediaFn: () => {},
      audioContextCtor: function TestAudioContext() {},
    },
    setTestStartingFn: () => calls.push('start:set-starting'),
    setTestingFn: () => calls.push('start:set-testing'),
    setTestDiagnosticsFn: () => calls.push('start:set-diagnostics'),
    clearPreviewPlaybackFn: () => calls.push('start:clear-preview'),
    attachMonitorOutputFn: () => calls.push('start:attach-monitor'),
    updateMicMeterFn: () => calls.push('start:update-meter'),
    applyNoiseSuppressionRoutingFn: () => calls.push('start:apply-routing'),
    startAppleVoiceIsolationTestFn: () => calls.push('start:apple'),
    runAudioSettingsMicTestStartFn: async (options) => {
      calls.push(['start', options.outputDevices.length, typeof options.deps.attachMonitorOutputFn]);
    },
  });

  await stopTest();
  await startTest();

  assert.deepEqual(calls, [
    ['stop', 9, 'mic-test'],
    ['start', 1, 'function'],
  ]);
});

test('audio settings mic test runtime builds apple isolation, restart, and close handlers with shared flow helpers', async () => {
  const calls = [];

  const startAppleVoiceIsolationTest = createAudioSettingsAppleIsolationHandler({
    refs: { testRunIdRef: { current: 4 } },
    deps: {
      getFriendlyAppleVoiceFallbackMessageFn: () => 'fallback',
    },
    updateMicMeterFn: () => calls.push('meter'),
    setTestDiagnosticsFn: () => calls.push('diagnostics'),
    setTestingFn: () => calls.push('testing'),
    setTestStartingFn: () => calls.push('starting'),
    attachMonitorOutputFn: () => calls.push('attach'),
    startAudioSettingsAppleIsolationTestFn: async (options) => {
      calls.push(['apple', options.refs.testRunIdRef.current, options.deps.activeVoiceMode]);
      return 'apple-started';
    },
  });

  const restartTest = createAudioSettingsRestartTestHandler({
    testing: true,
    stopTestFn: () => calls.push('stop'),
    startTestFn: () => calls.push('start'),
    restartAudioSettingsMicTestFn: (options) => {
      calls.push(['restart', options.testing, typeof options.stopTestFn, typeof options.startTestFn]);
    },
  });

  const handleClose = createAudioSettingsCloseHandler({
    stopTestFn: () => calls.push('close-stop'),
    onCloseFn: () => calls.push('on-close'),
    closeAudioSettingsFn: ({ stopTestFn, onCloseFn }) => {
      calls.push(['close', typeof stopTestFn, typeof onCloseFn]);
    },
  });

  const result = await startAppleVoiceIsolationTest({ activeVoiceMode: 'apple' });
  restartTest();
  handleClose();

  assert.equal(result, 'apple-started');
  assert.deepEqual(calls, [
    ['apple', 4, 'apple'],
    ['restart', true, 'function', 'function'],
    ['close', 'function', 'function'],
  ]);
});
