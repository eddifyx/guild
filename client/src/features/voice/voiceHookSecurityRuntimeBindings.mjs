export function buildUseVoiceHookSecurityRuntime({
  clearVoiceKeyFn,
  updateVoiceDiagnosticsFn,
} = {}) {
  return {
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  };
}
