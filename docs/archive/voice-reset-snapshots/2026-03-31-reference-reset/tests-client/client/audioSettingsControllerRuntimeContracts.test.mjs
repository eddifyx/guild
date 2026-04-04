import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAudioSettingsAppleIsolationContract,
  buildAudioSettingsAttachMonitorContract,
  buildAudioSettingsMicTestStartContract,
  buildAudioSettingsOutputChangeContract,
  buildAudioSettingsProcessingModeContract,
  buildAudioSettingsRuntimeEffectsContract,
} from '../../../client/src/features/voice/audioSettingsControllerRuntimeContracts.mjs';

test('audio settings controller runtime contracts prefer direct monitor playback on darwin default output', () => {
  const setTimeoutFn = () => {};
  const contract = buildAudioSettingsAttachMonitorContract({
    monitorGainRef: { current: { id: 'gain' } },
    previewAudioRef: { current: { id: 'preview' } },
    clearPreviewPlaybackFn: () => {},
    attachAudioSettingsMonitorOutputFn: () => {},
    windowObject: {
      setTimeout: setTimeoutFn,
      electronAPI: {
        getPlatform: () => 'darwin',
      },
    },
    AudioCtor: class FakeAudio {},
    HTMLMediaElementCtor: { HAVE_METADATA: 4 },
  });

  assert.equal(typeof contract.attachAudioSettingsMonitorOutputFn, 'function');
  assert.equal(typeof contract.setTimeoutFn, 'function');
  assert.equal(contract.haveMetadataReadyState, 4);
  assert.equal(contract.preferPreviewMonitorOnDefault, false);
});

test('audio settings controller runtime contracts keep preview playback enabled off darwin', () => {
  const contract = buildAudioSettingsAttachMonitorContract({
    monitorGainRef: { current: { id: 'gain' } },
    previewAudioRef: { current: { id: 'preview' } },
    clearPreviewPlaybackFn: () => {},
    attachAudioSettingsMonitorOutputFn: () => {},
    windowObject: {
      setTimeout: () => {},
      electronAPI: {
        getPlatform: () => 'win32',
      },
    },
    AudioCtor: class FakeAudio {},
    HTMLMediaElementCtor: { HAVE_METADATA: 4 },
  });

  assert.equal(contract.preferPreviewMonitorOnDefault, true);
});

test('audio settings controller runtime contracts build apple and mic-test contracts with canonical dependency bags', () => {
  const getUserMedia = async () => ({ id: 'stream' });
  const requestAnimationFrameFn = () => 1;
  const contract = buildAudioSettingsMicTestStartContract({
    refs: { processingModeRef: { current: 'standard' } },
    outputDevices: [{ deviceId: 'default' }],
    setTestStartingFn: () => {},
    setTestingFn: () => {},
    setTestDiagnosticsFn: () => {},
    clearPreviewPlaybackFn: () => {},
    attachMonitorOutputFn: () => {},
    updateMicMeterFn: () => {},
    applyNoiseSuppressionRoutingFn: () => {},
    startAppleVoiceIsolationTestFn: () => {},
    navigatorObject: { mediaDevices: { getUserMedia } },
    windowObject: { electronAPI: {} },
    localStorageObject: { getItem: () => '4' },
    AudioContextCtor: class FakeAudioContext {},
    requestAnimationFrameFn,
    consoleObject: { warn: () => {}, error: () => {} },
    createRnnoiseNodeFn: () => ({}),
    createSpeexNodeFn: () => ({}),
    createNoiseGateNodeFn: () => ({}),
    createSpeechFocusChainFn: () => ({}),
    createKeyboardSuppressorNodeFn: () => ({}),
    shouldDisableAppleVoiceForSessionFn: () => false,
    getFriendlyAppleVoiceFallbackMessageFn: () => 'fallback',
  });
  const appleContract = buildAudioSettingsAppleIsolationContract({
    refs: { testRunIdRef: { current: 1 } },
    updateMicMeterFn: () => {},
    setTestDiagnosticsFn: () => {},
    setTestingFn: () => {},
    setTestStartingFn: () => {},
    attachMonitorOutputFn: () => {},
    windowObject: {
      electronAPI: {
        startAppleVoiceCapture: () => {},
        stopAppleVoiceCapture: () => {},
        isAppleVoiceCaptureSupported: () => true,
      },
    },
    requestAnimationFrameFn,
    appleVoiceCaptureOwner: 'mic-test',
    createApplePcmBridgeNodeFn: () => ({}),
    getFriendlyAppleVoiceFallbackMessageFn: () => 'fallback',
    normalizeElectronBinaryChunkFn: () => new Float32Array(),
  });

  assert.deepEqual(contract.outputDevices, [{ deviceId: 'default' }]);
  assert.equal(typeof contract.deps.getUserMediaFn, 'function');
  assert.equal(contract.deps.getPlatformFn(), 'darwin');
  assert.equal(typeof contract.deps.startAudioSettingsBrowserMicTestFn, 'function');
  assert.equal(typeof contract.deps.createRnnoiseNodeFn, 'function');
  assert.equal(typeof appleContract.deps.startAppleVoiceCaptureFn, 'function');
  assert.equal(appleContract.deps.requestAnimationFrameFn, requestAnimationFrameFn);
});

test('audio settings controller runtime contracts build runtime-effects, output, and processing contracts coherently', () => {
  const restartTestFn = () => {};
  const runtimeEffectsContract = buildAudioSettingsRuntimeEffectsContract({
    selectedInput: 'mic-1',
    selectedOutput: 'speaker-1',
    processingMode: 'standard',
    noiseSuppression: true,
    voiceProcessingMode: 'voice-focused',
    testing: true,
    openTraceId: 'trace-1',
    outputDevices: [{ deviceId: 'speaker-1' }],
    refs: { selectedInputRef: { current: 'mic-1' } },
    state: { setProcessingModeStateFn: () => {} },
    restartTestFn,
    stopTestFn: () => {},
    updateMicMeterFn: () => {},
    windowObject: { electronAPI: { isAppleVoiceCaptureSupported: () => true } },
  });
  const outputContract = buildAudioSettingsOutputChangeContract({
    refs: { selectedOutputRef: { current: 'speaker-1' } },
    outputDevices: [{ deviceId: 'speaker-1' }],
    selectOutputFn: () => {},
    setOutputDeviceFn: () => {},
    restartTestFn,
    setTestDiagnosticsFn: () => {},
  });
  const processingContract = buildAudioSettingsProcessingModeContract({
    testing: true,
    refs: { processingModeRef: { current: 'standard' } },
    setVoiceProcessingModeFn: () => {},
    setProcessingModeStateFn: () => {},
    setNoiseSuppressionStateFn: () => {},
    restartTestFn,
  });

  assert.equal(runtimeEffectsContract.selectedInput, 'mic-1');
  assert.equal(typeof runtimeEffectsContract.deps.restartTestFn, 'function');
  assert.equal(typeof outputContract.runtime.resolveOutputSelectionFn, 'function');
  assert.equal(typeof processingContract.runtime.restartTestFn, 'function');
});
