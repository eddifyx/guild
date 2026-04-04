export function buildUseVoiceHookMediaTransportRuntime({
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
