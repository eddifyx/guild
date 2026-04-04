import { buildUseVoiceHookActionUiOptions } from './voiceHookActionRuntimeBuilders.mjs';
import { buildUseVoiceHookActionUiCoreRuntimeOptions } from './voiceHookActionUiCoreRuntimeOptions.mjs';
import { buildUseVoiceHookActionUiEnvironment } from './voiceHookActionUiEnvironment.mjs';

export function buildUseVoiceHookActionUiControllerOptions({
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
  const coreRuntimeOptions = buildUseVoiceHookActionUiCoreRuntimeOptions({
    socket,
    applyNoiseSuppressionRoutingFn,
    coreRuntime,
  });
  const environment = buildUseVoiceHookActionUiEnvironment();

  return buildUseVoiceHookActionUiOptions({
    socket,
    state,
    refs,
    applyNoiseSuppressionRoutingFn,
    applyVoiceModeDependenciesFn,
    persistVoiceProcessingModeFn,
    persistNoiseSuppressionEnabledFn,
    isUltraLowLatencyModeFn,
    ...coreRuntimeOptions,
    ...environment,
  });
}
