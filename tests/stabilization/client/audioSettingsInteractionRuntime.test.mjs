import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAudioSettingsInputChangeHandler,
  createAudioSettingsOutputChangeHandler,
  createAudioSettingsSelectProcessingModeHandler,
} from '../../../client/src/features/voice/audioSettingsInteractionRuntime.mjs';

test('audio settings interaction runtime builds the canonical output change action', () => {
  let receivedOptions = null;

  const handleOutputChange = createAudioSettingsOutputChangeHandler({
    refs: {
      selectedOutputRef: { current: 'speaker-1' },
    },
    outputDevices: [{ deviceId: 'speaker-2' }],
    runtime: {
      restartTestFn: () => {},
      setOutputDeviceFn: () => {},
    },
    applyAudioSettingsOutputChangeFn: (options) => {
      receivedOptions = options;
      return { changed: true };
    },
  });

  const result = handleOutputChange('speaker-2');

  assert.deepEqual(result, { changed: true });
  assert.equal(receivedOptions.deviceId, 'speaker-2');
  assert.deepEqual(receivedOptions.outputDevices, [{ deviceId: 'speaker-2' }]);
  assert.equal(typeof receivedOptions.restartTestFn, 'function');
});

test('audio settings interaction runtime updates input selection and restarts the active test', () => {
  const calls = [];
  const selectedInputRef = { current: 'mic-1' };

  const handleInputChange = createAudioSettingsInputChangeHandler({
    selectedInputRef,
    selectInputFn: (deviceId) => calls.push(['select', deviceId]),
    restartTestFn: () => calls.push(['restart']),
  });

  handleInputChange('mic-2');

  assert.equal(selectedInputRef.current, 'mic-2');
  assert.deepEqual(calls, [
    ['select', 'mic-2'],
    ['restart'],
  ]);
});

test('audio settings interaction runtime builds the canonical processing-mode action', () => {
  let receivedOptions = null;

  const handleSelectProcessingMode = createAudioSettingsSelectProcessingModeHandler({
    testing: true,
    refs: {
      processingModeRef: { current: 'standard' },
      noiseSuppressionRef: { current: true },
    },
    runtime: {
      restartTestFn: () => {},
      setVoiceProcessingModeFn: () => {},
      setProcessingModeStateFn: () => {},
      setNoiseSuppressionStateFn: () => {},
    },
    applyAudioSettingsProcessingModeChangeFn: (options) => {
      receivedOptions = options;
      return { mode: options.nextMode };
    },
  });

  const result = handleSelectProcessingMode('ultra-low-latency');

  assert.deepEqual(result, { mode: 'ultra-low-latency' });
  assert.equal(receivedOptions.nextMode, 'ultra-low-latency');
  assert.equal(receivedOptions.testing, true);
  assert.equal(typeof receivedOptions.restartTestFn, 'function');
});
