export function buildAudioSettingsStopTestOptions({
  refs = {},
  deps = {},
} = {}) {
  return {
    refs,
    deps,
  };
}

export function buildAudioSettingsStopTestHandlerOptions({
  refs = {},
  deps = {},
  clearPreviewPlaybackFn,
  updateMicMeterFn,
  setTestStartingFn,
  setTestingFn,
  setTestDiagnosticsFn,
} = {}) {
  return {
    refs,
    deps,
    clearPreviewPlaybackFn,
    updateMicMeterFn,
    setTestStartingFn,
    setTestingFn,
    setTestDiagnosticsFn,
  };
}

export function buildAudioSettingsAppleIsolationOptions({
  refs = {},
  deps = {},
} = {}) {
  return {
    refs,
    deps,
  };
}

export function buildAudioSettingsAppleIsolationHandlerOptions({
  refs = {},
  deps = {},
  updateMicMeterFn,
  setTestDiagnosticsFn,
  setTestingFn,
  setTestStartingFn,
  attachMonitorOutputFn,
} = {}) {
  return {
    refs,
    deps,
    updateMicMeterFn,
    setTestDiagnosticsFn,
    setTestingFn,
    setTestStartingFn,
    attachMonitorOutputFn,
  };
}

export function buildAudioSettingsAppleIsolationDeps({
  createApplePcmBridgeNodeFn,
  getFriendlyAppleVoiceFallbackMessageFn,
  normalizeElectronBinaryChunkFn,
  startAppleVoiceCaptureFn,
  stopAppleVoiceCaptureFn,
  isAppleVoiceCaptureSupportedFn,
  onAppleVoiceCaptureFrameFn,
  onAppleVoiceCaptureStateFn,
  getVoiceAudioContextOptionsFn,
  performanceNowFn,
  roundMsFn,
  requestAnimationFrameFn,
} = {}) {
  return {
    createApplePcmBridgeNodeFn,
    getFriendlyAppleVoiceFallbackMessageFn,
    normalizeElectronBinaryChunkFn,
    startAppleVoiceCaptureFn,
    stopAppleVoiceCaptureFn,
    isAppleVoiceCaptureSupportedFn,
    onAppleVoiceCaptureFrameFn,
    onAppleVoiceCaptureStateFn,
    getVoiceAudioContextOptionsFn,
    performanceNowFn,
    roundMsFn,
    requestAnimationFrameFn,
  };
}
