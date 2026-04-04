import {
  buildUseVoiceHookActionUiControllerOptions,
} from './voiceHookActionRuntimeBindings.mjs';

export function buildUseVoiceHookActionUiRuntimeInput({
  socket = null,
  state = {},
  refs = {},
  applyNoiseSuppressionRoutingFn,
  applyVoiceModeDependenciesFn,
  persistVoiceProcessingModeFn,
  persistNoiseSuppressionEnabledFn,
  isUltraLowLatencyModeFn,
  coreRuntime = {},
} = {}) {
  return buildUseVoiceHookActionUiControllerOptions({
    socket,
    state,
    refs,
    applyNoiseSuppressionRoutingFn,
    applyVoiceModeDependenciesFn,
    persistVoiceProcessingModeFn,
    persistNoiseSuppressionEnabledFn,
    isUltraLowLatencyModeFn,
    coreRuntime,
  });
}
