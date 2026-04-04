import { buildUseVoiceHookActionSessionControllerOptions } from './voiceHookActionRuntimeBindings.mjs';

export function buildUseVoiceHookActionSessionActionsInput({
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
  coreRuntime = {},
} = {}) {
  return buildUseVoiceHookActionSessionControllerOptions({
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
  });
}
