import {
  buildAudioSettingsOutputChangeContract,
  buildAudioSettingsProcessingModeContract,
} from './audioSettingsControllerRuntimeContracts.mjs';
import {
  buildAudioSettingsInputChangeHandlerOptions,
} from './audioSettingsControllerBindings.mjs';
import {
  createAudioSettingsInputChangeHandler,
  createAudioSettingsOutputChangeHandler,
  createAudioSettingsSelectProcessingModeHandler,
} from './audioSettingsInteractionRuntime.mjs';

export function resolveAudioSettingsControllerInteractionActionDeps({
  deps = {},
} = {}) {
  return {
    createAudioSettingsOutputChangeHandlerFn:
      deps.createAudioSettingsOutputChangeHandlerFn || createAudioSettingsOutputChangeHandler,
    buildAudioSettingsOutputChangeContractFn:
      deps.buildAudioSettingsOutputChangeContractFn || buildAudioSettingsOutputChangeContract,
    createAudioSettingsInputChangeHandlerFn:
      deps.createAudioSettingsInputChangeHandlerFn || createAudioSettingsInputChangeHandler,
    buildAudioSettingsInputChangeHandlerOptionsFn:
      deps.buildAudioSettingsInputChangeHandlerOptionsFn || buildAudioSettingsInputChangeHandlerOptions,
    createAudioSettingsSelectProcessingModeHandlerFn:
      deps.createAudioSettingsSelectProcessingModeHandlerFn || createAudioSettingsSelectProcessingModeHandler,
    buildAudioSettingsProcessingModeContractFn:
      deps.buildAudioSettingsProcessingModeContractFn || buildAudioSettingsProcessingModeContract,
  };
}
