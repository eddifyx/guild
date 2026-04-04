import {
  buildUseAudioSettingsRuntimeEffectsDeps,
  buildUseAudioSettingsRuntimeEffectsOptions,
} from './audioSettingsControllerBindings.mjs';

function resolveWindowObject(windowObject) {
  return windowObject || globalThis.window || globalThis;
}

export function buildAudioSettingsRuntimeEffectsContract({
  selectedInput,
  selectedOutput,
  processingMode,
  noiseSuppression,
  voiceProcessingMode,
  testing,
  openTraceId,
  outputDevices = [],
  refs = {},
  state = {},
  restartTestFn,
  stopTestFn,
  updateMicMeterFn,
  windowObject,
} = {}) {
  const resolvedWindow = resolveWindowObject(windowObject);
  return buildUseAudioSettingsRuntimeEffectsOptions({
    refs,
    state: {
      ...state,
      selectedInput,
      selectedOutput,
      processingMode,
      noiseSuppression,
      voiceProcessingMode,
      testing,
      openTraceId,
      outputDevices,
    },
    deps: buildUseAudioSettingsRuntimeEffectsDeps({
      restartTestFn,
      stopTestFn,
      updateMicMeterFn,
      isAppleVoiceCaptureSupportedFn: resolvedWindow.electronAPI?.isAppleVoiceCaptureSupported,
      primeAppleVoiceCaptureFn: resolvedWindow.electronAPI?.primeAppleVoiceCapture,
    }),
  });
}
