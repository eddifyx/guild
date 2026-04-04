import { useVoiceHookUiControllerRuntime } from './useVoiceHookUiControllerRuntime.mjs';
import { buildUseVoiceHookUiControllerOptions } from './voiceHookControllerBindings.mjs';
import { buildUseVoiceHookUiControllerRuntimeValue } from './voiceHookControllerRuntimeBuilders.mjs';

export function useVoiceHookUiActionsController({
  socket = null,
  state = {},
  refs = {},
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
  return useVoiceHookUiControllerRuntime(buildUseVoiceHookUiControllerOptions({
    socket,
    state,
    refs,
    runtime: buildUseVoiceHookUiControllerRuntimeValue({
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
    }),
  }));
}
