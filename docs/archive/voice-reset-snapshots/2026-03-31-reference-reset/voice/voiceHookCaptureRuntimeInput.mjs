export function buildUseVoiceHookCaptureRuntimeInput({
  socket = null,
  state = {},
  refs = {},
  applyNoiseSuppressionRoutingFn,
  updateVoiceDiagnosticsFn,
  applySenderPreferencesFn,
  getVoiceAudioBypassModeFn,
} = {}) {
  return {
    socket,
    state,
    refs,
    applyNoiseSuppressionRoutingFn,
    updateVoiceDiagnosticsFn,
    applySenderPreferencesFn,
    getVoiceAudioBypassModeFn,
  };
}
