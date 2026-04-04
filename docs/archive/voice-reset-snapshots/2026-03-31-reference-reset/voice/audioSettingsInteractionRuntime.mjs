import {
  applyAudioSettingsOutputChange,
  applyAudioSettingsProcessingModeChange,
} from './audioSettingsActionFlow.mjs';
import {
  buildAudioSettingsOutputChangeOptions,
  buildAudioSettingsProcessingModeChangeOptions,
} from './audioSettingsControllerBindings.mjs';

export function createAudioSettingsOutputChangeHandler({
  refs = {},
  outputDevices = [],
  runtime = {},
  applyAudioSettingsOutputChangeFn = applyAudioSettingsOutputChange,
} = {}) {
  return function handleOutputChange(deviceId) {
    return applyAudioSettingsOutputChangeFn(buildAudioSettingsOutputChangeOptions({
      deviceId,
      refs,
      outputDevices,
      runtime,
    }));
  };
}

export function createAudioSettingsInputChangeHandler({
  selectedInputRef,
  selectInputFn = () => {},
  restartTestFn = () => {},
} = {}) {
  return function handleInputChange(deviceId) {
    if (selectedInputRef) {
      selectedInputRef.current = deviceId;
    }
    selectInputFn(deviceId);
    restartTestFn();
  };
}

export function createAudioSettingsSelectProcessingModeHandler({
  testing = false,
  refs = {},
  runtime = {},
  applyAudioSettingsProcessingModeChangeFn = applyAudioSettingsProcessingModeChange,
} = {}) {
  return function handleSelectProcessingMode(nextMode) {
    return applyAudioSettingsProcessingModeChangeFn(buildAudioSettingsProcessingModeChangeOptions({
      nextMode,
      testing,
      refs,
      runtime,
    }));
  };
}
