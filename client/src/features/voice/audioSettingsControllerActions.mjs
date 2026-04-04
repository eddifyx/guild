import { resolveAudioSettingsControllerActionDeps } from './audioSettingsControllerActionDeps.mjs';
import { buildAudioSettingsControllerMicTestActions } from './audioSettingsControllerMicTestActions.mjs';
import { buildAudioSettingsControllerInteractionActions } from './audioSettingsControllerInteractionActions.mjs';

export function createAudioSettingsControllerActions({
  onClose,
  outputDevices = [],
  testing = false,
  refs = {},
  state = {},
  actions = {},
  deps = {},
} = {}) {
  const resolvedDeps = resolveAudioSettingsControllerActionDeps({ deps });
  const micTestActions = buildAudioSettingsControllerMicTestActions({
    onClose,
    outputDevices,
    testing,
    refs,
    state,
    deps: resolvedDeps,
  });
  const interactionActions = buildAudioSettingsControllerInteractionActions({
    outputDevices,
    testing,
    refs,
    state,
    actions,
    deps: resolvedDeps,
    restartTestFn: micTestActions.restartTest,
  });

  return {
    updateMicMeter: micTestActions.updateMicMeter,
    stopTest: micTestActions.stopTest,
    restartTest: micTestActions.restartTest,
    handleClose: micTestActions.handleClose,
    startTest: micTestActions.startTest,
    handleOutputChange: interactionActions.handleOutputChange,
    handleInputChange: interactionActions.handleInputChange,
    handleSelectProcessingMode: interactionActions.handleSelectProcessingMode,
  };
}
