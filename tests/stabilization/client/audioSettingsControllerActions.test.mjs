import test from 'node:test';
import assert from 'node:assert/strict';

import { createAudioSettingsControllerActions } from '../../../client/src/features/voice/audioSettingsControllerActions.mjs';

test('audio settings controller actions build canonical handlers through one runtime factory', async () => {
  const calls = [];
  const refs = {
    previewAudioRef: { current: { id: 'preview-1' } },
    monitorGainRef: { current: { id: 'monitor-1' } },
    testRunIdRef: { current: 'run-1' },
    selectedInputRef: { current: 'mic-1' },
    selectedOutputRef: { current: 'speaker-1' },
    processingModeRef: { current: 'standard' },
    noiseSuppressionRef: { current: true },
    skipSelectedOutputSyncRestartRef: { current: false },
    meterFillRef: { current: { style: {} } },
    meterValueRef: { current: { style: {}, textContent: '' } },
    meterStatusRef: { current: { textContent: '' } },
    appleVoiceAvailableRef: { current: true },
  };
  const state = {
    setTestingFn: (value) => calls.push(['setTesting', value]),
    setTestStartingFn: (value) => calls.push(['setTestStarting', value]),
    setNoiseSuppressionStateFn: (value) => calls.push(['setNoiseSuppression', value]),
    setProcessingModeStateFn: (value) => calls.push(['setProcessingModeState', value]),
    setTestDiagnosticsFn: (value) => calls.push(['setDiagnostics', value]),
  };
  const actions = {
    selectInputFn: (value) => calls.push(['selectInput', value]),
    selectOutputFn: (value) => calls.push(['selectOutput', value]),
    setOutputDeviceFn: (value) => calls.push(['setOutputDevice', value]),
    setVoiceProcessingModeFn: (value) => calls.push(['setVoiceProcessingMode', value]),
  };

  const controllerActions = createAudioSettingsControllerActions({
    onClose: () => calls.push(['onClose']),
    outputDevices: [{ deviceId: 'speaker-1' }],
    testing: true,
    refs,
    state,
    actions,
    deps: {
      updateAudioSettingsMicMeterFn: ({ level }) => {
        calls.push(['updateMicMeter', level]);
        return { normalized: level };
      },
      applyAudioSettingsNoiseSuppressionRoutingFn: ({ enabled }) => {
        calls.push(['applyNoiseSuppressionRouting', enabled]);
        return enabled;
      },
      createAudioSettingsClearPreviewPlaybackHandlerFn: () => () => calls.push(['clearPreviewPlayback']),
      buildAudioSettingsAttachMonitorContractFn: (payload) => ({ kind: 'attachMonitor', payload }),
      createAudioSettingsAttachMonitorOutputHandlerFn: (contract) => () => calls.push(['attachMonitorOutput', contract.kind]),
      buildAudioSettingsStopTestHandlerOptionsFn: (payload) => ({ kind: 'stopTest', payload }),
      createAudioSettingsStopTestHandlerFn: (contract) => () => calls.push(['stopTest', contract.kind]),
      buildAudioSettingsAppleIsolationContractFn: (payload) => ({ kind: 'appleIsolation', payload }),
      createAudioSettingsAppleIsolationHandlerFn: (contract) => () => calls.push(['appleIsolation', contract.kind]),
      createAudioSettingsCloseHandlerFn: ({ stopTestFn, onCloseFn }) => () => {
        calls.push(['handleClose']);
        stopTestFn();
        onCloseFn();
      },
      buildAudioSettingsMicTestStartContractFn: (payload) => ({ kind: 'startTest', payload }),
      createAudioSettingsStartTestHandlerFn: (contract) => () => {
        calls.push(['startTest', contract.kind]);
        contract.payload.attachMonitorOutputFn();
        contract.payload.applyNoiseSuppressionRoutingFn(true);
        return contract.kind;
      },
      buildAudioSettingsRestartTestHandlerOptionsFn: (payload) => ({ kind: 'restartTest', payload }),
      createAudioSettingsRestartTestHandlerFn: (contract) => () => {
        calls.push(['restartTest', contract.kind]);
        contract.payload.stopTestFn();
        return contract.kind;
      },
      restartAudioSettingsMicTestFn: () => calls.push(['restartAudioSettingsMicTest']),
      buildAudioSettingsOutputChangeContractFn: (payload) => ({ kind: 'outputChange', payload }),
      createAudioSettingsOutputChangeHandlerFn: (contract) => (value) => calls.push(['outputChange', contract.kind, value]),
      buildAudioSettingsInputChangeHandlerOptionsFn: (payload) => ({ kind: 'inputChange', payload }),
      createAudioSettingsInputChangeHandlerFn: (contract) => (value) => calls.push(['inputChange', contract.kind, value]),
      buildAudioSettingsProcessingModeContractFn: (payload) => ({ kind: 'processingChange', payload }),
      createAudioSettingsSelectProcessingModeHandlerFn: (contract) => (value) => calls.push(['processingChange', contract.kind, value]),
      createApplePcmBridgeNodeFn: () => ({}),
      getFriendlyAppleVoiceFallbackMessageFn: () => 'fallback',
      normalizeElectronBinaryChunkFn: (value) => value,
      createRnnoiseNodeFn: () => ({}),
      createSpeexNodeFn: () => ({}),
      createNoiseGateNodeFn: () => ({}),
      createSpeechFocusChainFn: () => ({}),
      createKeyboardSuppressorNodeFn: () => ({}),
      shouldDisableAppleVoiceForSessionFn: () => false,
      appleVoiceCaptureOwner: 'mic-test',
    },
  });

  assert.deepEqual(controllerActions.updateMicMeter(42), { normalized: 42 });
  assert.equal(controllerActions.startTest(), 'startTest');
  assert.equal(controllerActions.restartTest(), 'restartTest');
  controllerActions.stopTest();
  controllerActions.handleClose();
  controllerActions.handleOutputChange('speaker-2');
  controllerActions.handleInputChange('mic-2');
  controllerActions.handleSelectProcessingMode('voice-focused');

  assert.equal(calls.some((entry) => entry[0] === 'attachMonitorOutput'), true);
  assert.equal(calls.some((entry) => entry[0] === 'applyNoiseSuppressionRouting' && entry[1] === true), true);
  assert.equal(calls.some((entry) => entry[0] === 'handleClose'), true);
  assert.equal(calls.some((entry) => entry[0] === 'outputChange' && entry[2] === 'speaker-2'), true);
  assert.equal(calls.some((entry) => entry[0] === 'inputChange' && entry[2] === 'mic-2'), true);
  assert.equal(calls.some((entry) => entry[0] === 'processingChange' && entry[2] === 'voice-focused'), true);
});
