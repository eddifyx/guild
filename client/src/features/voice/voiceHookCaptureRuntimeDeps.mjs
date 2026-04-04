export function buildUseVoiceHookCaptureRuntimeDeps({
  applyNoiseSuppressionRoutingFn,
  updateVoiceDiagnosticsFn,
  applySenderPreferencesFn,
  getVoiceAudioBypassModeFn,
} = {}) {
  return {
    applyNoiseSuppressionRoutingFn,
    updateVoiceDiagnosticsFn,
    applySenderPreferencesFn,
    getVoiceAudioBypassModeFn,
  };
}
