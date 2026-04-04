export function buildUseVoiceHookCaptureRuntime({
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
