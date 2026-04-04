import { useVoiceHookRuntimeEffectsController } from './useVoiceHookRuntimeEffectsController.mjs';
import { useVoiceHookSessionActionsController } from './useVoiceHookSessionActionsController.mjs';
import {
  buildUseVoiceHookActionSessionActionsInput,
  buildUseVoiceHookActionSessionRuntimeEffectsInput,
  buildUseVoiceHookActionSessionRuntimeValue,
  syncUseVoiceHookActionSessionLeaveRef,
} from './voiceHookActionSessionRuntimeControllerInputs.mjs';

export function useVoiceHookActionSessionRuntimeController({
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
  roundRateFn,
  coreRuntime = {},
} = {}) {
  const voiceSessionActions = useVoiceHookSessionActionsController(buildUseVoiceHookActionSessionActionsInput({
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
    coreRuntime,
  }));

  const {
    resetVoiceSession,
    handleUnexpectedVoiceSessionEnd,
    joinChannel,
    leaveChannel,
  } = voiceSessionActions;

  syncUseVoiceHookActionSessionLeaveRef({
    refs,
    leaveChannel,
  });

  useVoiceHookRuntimeEffectsController(buildUseVoiceHookActionSessionRuntimeEffectsInput({
    socket,
    userId,
    state,
    refs,
    isExpectedVoiceTeardownErrorFn,
    roundRateFn,
    resetVoiceSessionFn: resetVoiceSession,
    handleUnexpectedVoiceSessionEndFn: handleUnexpectedVoiceSessionEnd,
    coreRuntime,
  }));

  return buildUseVoiceHookActionSessionRuntimeValue({
    joinChannel,
    leaveChannel,
  });
}
