export function buildAudioSettingsProcessingModeChangeOptions({
  nextMode,
  testing = false,
  refs = {},
  runtime = {},
} = {}) {
  return {
    nextMode,
    testing,
    refs,
    ...runtime,
  };
}

export function buildAudioSettingsProcessingModeHandlerOptions({
  testing = false,
  refs = {},
  runtime = {},
} = {}) {
  return {
    testing,
    refs,
    runtime,
  };
}

export function buildAudioSettingsProcessingModeRuntime({
  setVoiceProcessingModeFn,
  setProcessingModeStateFn,
  setNoiseSuppressionStateFn,
  restartTestFn,
  startPerfTraceFn,
  addPerfPhaseFn,
  endPerfTraceAfterNextPaintFn,
  isUltraLowLatencyModeFn,
  voiceProcessingModes,
} = {}) {
  return {
    setVoiceProcessingModeFn,
    setProcessingModeStateFn,
    setNoiseSuppressionStateFn,
    restartTestFn,
    startPerfTraceFn,
    addPerfPhaseFn,
    endPerfTraceAfterNextPaintFn,
    isUltraLowLatencyModeFn,
    voiceProcessingModes,
  };
}
