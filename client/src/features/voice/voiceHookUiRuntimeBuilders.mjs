import { buildUseVoiceHookUiRuntime } from './voiceHookControllerRuntimeBindings.mjs';
import { buildUseVoiceHookUiRuntimeDeps } from './voiceHookControllerRuntimeDeps.mjs';

export function buildUseVoiceHookUiControllerRuntimeValue({
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
  return buildUseVoiceHookUiRuntime(buildUseVoiceHookUiRuntimeDeps({
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
  }));
}
