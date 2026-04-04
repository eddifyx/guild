import { useVoiceUiActionController } from './useVoiceUiActionController.mjs';
import {
  buildVoiceUiActionControllerOptions,
  buildVoiceUiActionRuntime,
} from './voiceHookBindings.mjs';

export function useVoiceHookUiControllerRuntime({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return useVoiceUiActionController(
    buildVoiceUiActionControllerOptions({
      state,
      refs,
      runtime: buildVoiceUiActionRuntime({
        socket,
        clearVoiceHealthProbeFn: runtime.clearVoiceHealthProbeFn,
        scheduleVoiceHealthProbeFn: runtime.scheduleVoiceHealthProbeFn,
        scheduleVoiceLiveReconfigureFlowFn: runtime.scheduleVoiceLiveReconfigureFlowFn,
        clearTimeoutFn: runtime.clearTimeoutFn,
        setTimeoutFn: runtime.setTimeoutFn,
        cancelPerfTraceFn: runtime.cancelPerfTraceFn,
        addPerfPhaseFn: runtime.addPerfPhaseFn,
        reconfigureLiveCaptureFn: runtime.reconfigureLiveCaptureFn,
        startPerfTraceFn: runtime.startPerfTraceFn,
        endPerfTraceFn: runtime.endPerfTraceFn,
        switchLiveCaptureModeInPlaceFn: runtime.switchLiveCaptureModeInPlaceFn,
        applyNoiseSuppressionRoutingFn: runtime.applyNoiseSuppressionRoutingFn,
        applyVoiceModeDependenciesFn: runtime.applyVoiceModeDependenciesFn,
        persistVoiceProcessingModeFn: runtime.persistVoiceProcessingModeFn,
        persistNoiseSuppressionEnabledFn: runtime.persistNoiseSuppressionEnabledFn,
        isUltraLowLatencyModeFn: runtime.isUltraLowLatencyModeFn,
      }),
      deps: runtime.deps,
    })
  );
}
