export function buildUseVoiceHookActionUiCoreRuntimeOptions({
  socket = null,
  applyNoiseSuppressionRoutingFn,
  coreRuntime = {},
} = {}) {
  const {
    clearVoiceHealthProbe,
    switchLiveCaptureModeInPlace,
    reconfigureLiveCapture,
    scheduleVoiceHealthProbe,
  } = coreRuntime;

  return {
    clearVoiceHealthProbeFn: clearVoiceHealthProbe,
    scheduleVoiceHealthProbeFn: scheduleVoiceHealthProbe,
    reconfigureLiveCaptureFn: reconfigureLiveCapture,
    switchLiveCaptureModeInPlaceFn: switchLiveCaptureModeInPlace,
    deps: [
      applyNoiseSuppressionRoutingFn,
      clearVoiceHealthProbe,
      reconfigureLiveCapture,
      scheduleVoiceHealthProbe,
      socket,
      switchLiveCaptureModeInPlace,
    ],
  };
}
