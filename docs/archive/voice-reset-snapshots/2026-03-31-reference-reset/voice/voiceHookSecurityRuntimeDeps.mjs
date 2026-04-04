export function buildUseVoiceHookSecurityRuntimeDeps({
  clearVoiceKeyFn,
  updateVoiceDiagnosticsFn,
} = {}) {
  return {
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  };
}
