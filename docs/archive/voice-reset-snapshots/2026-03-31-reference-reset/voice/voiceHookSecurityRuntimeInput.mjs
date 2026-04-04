export function buildUseVoiceHookSecurityRuntimeInput({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  clearVoiceKeyFn,
  updateVoiceDiagnosticsFn,
} = {}) {
  return {
    socket,
    userId,
    state,
    refs,
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  };
}
