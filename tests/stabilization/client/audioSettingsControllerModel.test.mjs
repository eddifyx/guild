import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAudioSettingsControllerState } from '../../../client/src/features/voice/audioSettingsControllerModel.mjs';

test('audio settings controller model shapes panel props and propagates mic gain changes', () => {
  const calls = [];
  const gainRef = { current: { gain: { value: 1 } } };

  const controller = buildAudioSettingsControllerState({
    handleClose: () => calls.push('close'),
    selectedInput: 'mic-1',
    inputDevices: [{ deviceId: 'mic-1', label: 'Mic' }],
    handleInputChange: (deviceId) => calls.push(['input', deviceId]),
    testing: true,
    testStarting: false,
    startTest: () => calls.push('start'),
    stopTest: () => calls.push('stop'),
    meterFillRef: { current: null },
    meterValueRef: { current: null },
    meterStatusRef: { current: null },
    activeMonitorProfile: { key: 'monitor' },
    lowLatencyEnabled: false,
    noiseSuppression: true,
    noiseSuppressionFallbackReason: '',
    testDiagnostics: { mode: 'rnnoise' },
    micGain: 3,
    setMicGainStateFn: (value) => calls.push(['micGainState', value]),
    gainRef,
    setMicGainFn: (value) => calls.push(['setMicGain', value]),
    preferredSuppressionImplementation: 'rnnoise',
    appleHardwareProcessingGuidance: 'Use Voice Isolation in Control Center.',
    handleSelectProcessingMode: (value) => calls.push(['processing', value]),
    selectedOutput: 'spk-1',
    outputDevices: [{ deviceId: 'spk-1', label: 'Speaker' }],
    handleOutputChange: (deviceId) => calls.push(['output', deviceId]),
  });

  controller.inputPanelProps.handleInputChange('mic-2');
  controller.inputPanelProps.startTest();
  controller.inputPanelProps.stopTest();
  controller.sensitivityPanelProps.onMicGainChange(4.5);
  controller.processingPanelProps.handleSelectProcessingMode('ultra-low-latency');
  controller.outputPanelProps.handleOutputChange('spk-2');
  controller.footerProps.handleClose();

  assert.equal(controller.inputPanelProps.selectedInput, 'mic-1');
  assert.equal(controller.outputPanelProps.selectedOutput, 'spk-1');
  assert.equal(controller.processingPanelProps.appleHardwareProcessingGuidance, 'Use Voice Isolation in Control Center.');
  assert.equal(gainRef.current.gain.value, 4.5);
  assert.deepEqual(calls, [
    ['input', 'mic-2'],
    'start',
    'stop',
    ['micGainState', 4.5],
    ['setMicGain', 4.5],
    ['processing', 'ultra-low-latency'],
    ['output', 'spk-2'],
    'close',
  ]);
});
