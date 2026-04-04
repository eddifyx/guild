import { buildAudioSettingsControllerMicTestCoreActions } from './audioSettingsControllerMicTestCoreActions.mjs';
import { buildAudioSettingsControllerMicTestFlowActions } from './audioSettingsControllerMicTestFlowActions.mjs';

export function buildAudioSettingsControllerMicTestActions({
  onClose,
  outputDevices = [],
  testing = false,
  refs = {},
  state = {},
  deps = {},
} = {}) {
  const coreActions = buildAudioSettingsControllerMicTestCoreActions({
    refs,
    deps,
  });
  const flowActions = buildAudioSettingsControllerMicTestFlowActions({
    onClose,
    outputDevices,
    testing,
    refs,
    state,
    deps,
    coreActions,
  });

  return {
    ...coreActions,
    ...flowActions,
  };
}
