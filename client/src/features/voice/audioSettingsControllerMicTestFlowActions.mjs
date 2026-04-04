import { buildAudioSettingsControllerStopTestAction } from './audioSettingsControllerStopTestAction.mjs';
import { buildAudioSettingsControllerAppleIsolationAction } from './audioSettingsControllerAppleIsolationAction.mjs';
import { buildAudioSettingsControllerStartTestAction } from './audioSettingsControllerStartTestAction.mjs';
import { buildAudioSettingsControllerRestartTestAction } from './audioSettingsControllerRestartTestAction.mjs';

export function buildAudioSettingsControllerMicTestFlowActions({
  onClose,
  outputDevices = [],
  testing = false,
  refs = {},
  state = {},
  deps = {},
  coreActions = {},
} = {}) {
  const stopTest = buildAudioSettingsControllerStopTestAction({
    refs,
    state,
    deps,
    coreActions,
  });
  const startAppleVoiceIsolationTest = buildAudioSettingsControllerAppleIsolationAction({
    refs,
    state,
    deps,
    coreActions,
  });
  const handleClose = deps.createAudioSettingsCloseHandlerFn({
    stopTestFn: stopTest,
    onCloseFn: onClose,
  });
  const startTest = buildAudioSettingsControllerStartTestAction({
    outputDevices,
    refs,
    state,
    deps,
    coreActions,
    startAppleVoiceIsolationTest,
  });
  const restartTest = buildAudioSettingsControllerRestartTestAction({
    testing,
    deps,
    stopTest,
    startTest,
  });

  return {
    stopTest,
    startAppleVoiceIsolationTest,
    handleClose,
    startTest,
    restartTest,
  };
}
