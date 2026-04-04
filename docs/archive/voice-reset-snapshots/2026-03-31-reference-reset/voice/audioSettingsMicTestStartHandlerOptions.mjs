export function buildAudioSettingsMicTestStartHandlerOptions({
  refs = {},
  outputDevices = [],
  deps = {},
  setTestStartingFn,
  setTestingFn,
  setTestDiagnosticsFn,
  clearPreviewPlaybackFn,
  attachMonitorOutputFn,
  updateMicMeterFn,
  applyNoiseSuppressionRoutingFn,
  startAppleVoiceIsolationTestFn,
} = {}) {
  return {
    refs,
    outputDevices,
    deps,
    setTestStartingFn,
    setTestingFn,
    setTestDiagnosticsFn,
    clearPreviewPlaybackFn,
    attachMonitorOutputFn,
    updateMicMeterFn,
    applyNoiseSuppressionRoutingFn,
    startAppleVoiceIsolationTestFn,
  };
}
