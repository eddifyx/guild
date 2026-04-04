import { buildUseVoiceHookActionRuntimeEffectsOptions } from './voiceHookActionRuntimeBuilders.mjs';
import { buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions } from './voiceHookActionRuntimeEffectsCoreRuntimeOptions.mjs';
import { buildUseVoiceHookActionRuntimeEffectsEnvironment } from './voiceHookActionRuntimeEffectsEnvironment.mjs';
import { buildUseVoiceHookActionRuntimeEffectsStateOptions } from './voiceHookActionRuntimeEffectsStateOptions.mjs';

export function buildUseVoiceHookActionRuntimeEffectsControllerOptions({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  isExpectedVoiceTeardownErrorFn,
  roundRateFn,
  coreRuntime = {},
} = {}) {
  const stateOptions = buildUseVoiceHookActionRuntimeEffectsStateOptions({
    state,
  });
  const coreRuntimeOptions = buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions({
    coreRuntime,
  });
  const environment = buildUseVoiceHookActionRuntimeEffectsEnvironment();

  return buildUseVoiceHookActionRuntimeEffectsOptions({
    state,
    refs,
    socket,
    currentUserId: userId,
    handleUnexpectedVoiceSessionEndFn: undefined,
    isExpectedVoiceTeardownErrorFn,
    resetVoiceSessionFn: undefined,
    roundRateFn,
    ...stateOptions,
    ...coreRuntimeOptions,
    ...environment,
  });
}

export function buildUseVoiceHookActionRuntimeEffectsControllerResolvedOptions({
  handleUnexpectedVoiceSessionEndFn,
  resetVoiceSessionFn,
  options = {},
} = {}) {
  return {
    ...options,
    handleUnexpectedVoiceSessionEndFn,
    resetVoiceSessionFn,
  };
}
