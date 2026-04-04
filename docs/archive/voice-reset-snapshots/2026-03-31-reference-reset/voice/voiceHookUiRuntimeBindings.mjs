export function buildVoiceUiActionControllerOptions({
  state = {},
  refs = {},
  runtime = {},
  deps = [],
} = {}) {
  return {
    state,
    refs,
    runtime,
    deps,
  };
}

export function buildVoiceUiActionRuntime({
  socket = null,
  clearVoiceHealthProbeFn,
  scheduleVoiceHealthProbeFn,
  scheduleVoiceLiveReconfigureFlowFn,
  clearTimeoutFn,
  setTimeoutFn,
  cancelPerfTraceFn,
  addPerfPhaseFn,
  reconfigureLiveCaptureFn,
  startPerfTraceFn,
  endPerfTraceFn,
  switchLiveCaptureModeInPlaceFn,
  applyNoiseSuppressionRoutingFn,
  applyVoiceModeDependenciesFn,
  persistVoiceProcessingModeFn,
  persistNoiseSuppressionEnabledFn,
  isUltraLowLatencyModeFn,
} = {}) {
  return {
    socket,
    clearVoiceHealthProbeFn,
    scheduleVoiceHealthProbeFn,
    scheduleVoiceLiveReconfigureFlowFn,
    clearTimeoutFn,
    setTimeoutFn,
    cancelPerfTraceFn,
    addPerfPhaseFn,
    reconfigureLiveCaptureFn,
    startPerfTraceFn,
    endPerfTraceFn,
    switchLiveCaptureModeInPlaceFn,
    applyNoiseSuppressionRoutingFn,
    applyVoiceModeDependenciesFn,
    persistVoiceProcessingModeFn,
    persistNoiseSuppressionEnabledFn,
    isUltraLowLatencyModeFn,
  };
}

export function buildVoiceRuntimeBindingsControllerOptions({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    state,
    refs,
    runtime,
  };
}

export function buildVoiceRuntimeBindingsRuntime(runtime = {}) {
  return runtime;
}

export function buildUseVoiceHookUiRuntime({
  clearVoiceHealthProbeFn,
  scheduleVoiceHealthProbeFn,
  scheduleVoiceLiveReconfigureFlowFn,
  clearTimeoutFn,
  setTimeoutFn,
  cancelPerfTraceFn,
  addPerfPhaseFn,
  reconfigureLiveCaptureFn,
  startPerfTraceFn,
  endPerfTraceFn,
  switchLiveCaptureModeInPlaceFn,
  applyNoiseSuppressionRoutingFn,
  applyVoiceModeDependenciesFn,
  persistVoiceProcessingModeFn,
  persistNoiseSuppressionEnabledFn,
  isUltraLowLatencyModeFn,
  deps = [],
} = {}) {
  return {
    clearVoiceHealthProbeFn,
    scheduleVoiceHealthProbeFn,
    scheduleVoiceLiveReconfigureFlowFn,
    clearTimeoutFn,
    setTimeoutFn,
    cancelPerfTraceFn,
    addPerfPhaseFn,
    reconfigureLiveCaptureFn,
    startPerfTraceFn,
    endPerfTraceFn,
    switchLiveCaptureModeInPlaceFn,
    applyNoiseSuppressionRoutingFn,
    applyVoiceModeDependenciesFn,
    persistVoiceProcessingModeFn,
    persistNoiseSuppressionEnabledFn,
    isUltraLowLatencyModeFn,
    deps,
  };
}
