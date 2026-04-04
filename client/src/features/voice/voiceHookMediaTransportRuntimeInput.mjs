export function buildUseVoiceHookMediaTransportRuntimeInput({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  emitAsyncFn,
  recordLaneDiagnosticFn,
  updateVoiceDiagnosticsFn,
  resetScreenShareAdaptationFn,
  playStreamStopChimeFn,
  getPrimaryCodecMimeTypeFromRtpParametersFn,
  getExperimentalScreenVideoBypassModeFn,
  summarizeReceiverVideoCodecSupportFn,
} = {}) {
  return {
    socket,
    currentUserId: userId,
    state,
    refs,
    emitAsyncFn,
    recordLaneDiagnosticFn,
    updateVoiceDiagnosticsFn,
    resetScreenShareAdaptationFn,
    playStreamStopChimeFn,
    getPrimaryCodecMimeTypeFromRtpParametersFn,
    getExperimentalScreenVideoBypassModeFn,
    summarizeReceiverVideoCodecSupportFn,
  };
}
