export function buildUseAudioSettingsRuntimeEffectsOptions({
  state = {},
  refs = {},
  deps = {},
} = {}) {
  return {
    ...state,
    refs,
    state,
    deps,
  };
}

export function buildUseAudioSettingsRuntimeEffectsDeps({
  restartTestFn,
  stopTestFn,
  updateMicMeterFn,
  isAppleVoiceCaptureSupportedFn,
  primeAppleVoiceCaptureFn,
} = {}) {
  return {
    restartTestFn,
    stopTestFn,
    updateMicMeterFn,
    isAppleVoiceCaptureSupportedFn,
    primeAppleVoiceCaptureFn,
  };
}
