import { useVoiceHookActionSessionRuntimeController } from './useVoiceHookActionSessionRuntimeController.mjs';
import { useVoiceHookUiActionsController } from './useVoiceHookUiActionsController.mjs';
import {
  buildUseVoiceHookActionSessionRuntimeInput,
  buildUseVoiceHookActionUiRuntimeInput,
} from './voiceHookActionRuntimeControllerInputs.mjs';

export function useVoiceHookActionRuntimeController({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  emitAsyncFn,
  clearVoiceKeyFn,
  setVoiceChannelIdFn,
  setVoiceChannelParticipantsFn,
  recordLaneDiagnosticFn,
  isExpectedVoiceTeardownErrorFn,
  normalizeVoiceErrorMessageFn,
  applyNoiseSuppressionRoutingFn,
  applyVoiceModeDependenciesFn,
  persistVoiceProcessingModeFn,
  persistNoiseSuppressionEnabledFn,
  isUltraLowLatencyModeFn,
  roundRateFn,
  coreRuntime = {},
} = {}) {
  const voiceSessionActions = useVoiceHookActionSessionRuntimeController(buildUseVoiceHookActionSessionRuntimeInput({
    socket,
    userId,
    state,
    refs,
    emitAsyncFn,
    clearVoiceKeyFn,
    setVoiceChannelIdFn,
    setVoiceChannelParticipantsFn,
    recordLaneDiagnosticFn,
    isExpectedVoiceTeardownErrorFn,
    normalizeVoiceErrorMessageFn,
    roundRateFn,
    coreRuntime,
  }));

  const {
    joinChannel,
    leaveChannel,
  } = voiceSessionActions;

  const voiceUiActions = useVoiceHookUiActionsController(buildUseVoiceHookActionUiRuntimeInput({
    socket,
    state,
    refs,
    applyNoiseSuppressionRoutingFn,
    applyVoiceModeDependenciesFn,
    persistVoiceProcessingModeFn,
    persistNoiseSuppressionEnabledFn,
    isUltraLowLatencyModeFn,
    coreRuntime,
  }));

  return {
    joinChannel,
    leaveChannel,
    ...voiceUiActions,
  };
}
