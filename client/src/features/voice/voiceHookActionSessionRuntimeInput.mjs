export function buildUseVoiceHookActionSessionRuntimeInput({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  emitAsyncFn,
  clearVoiceKeyFn,
  setVoiceChannelParticipantsFn,
  recordLaneDiagnosticFn,
  isExpectedVoiceTeardownErrorFn,
  normalizeVoiceErrorMessageFn,
  roundRateFn,
  coreRuntime = {},
} = {}) {
  return {
    socket,
    userId,
    state,
    refs,
    emitAsyncFn,
    clearVoiceKeyFn,
    setVoiceChannelParticipantsFn,
    recordLaneDiagnosticFn,
    isExpectedVoiceTeardownErrorFn,
    normalizeVoiceErrorMessageFn,
    roundRateFn,
    coreRuntime,
  };
}
