import {
  buildUseVoiceHookActionRuntimeEffectsControllerOptions,
  buildUseVoiceHookActionRuntimeEffectsControllerResolvedOptions,
} from './voiceHookActionRuntimeBindings.mjs';

export function buildUseVoiceHookActionSessionRuntimeEffectsInput({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  isExpectedVoiceTeardownErrorFn,
  roundRateFn,
  resetVoiceSessionFn,
  handleUnexpectedVoiceSessionEndFn,
  coreRuntime = {},
} = {}) {
  return buildUseVoiceHookActionRuntimeEffectsControllerResolvedOptions({
    handleUnexpectedVoiceSessionEndFn,
    resetVoiceSessionFn,
    options: buildUseVoiceHookActionRuntimeEffectsControllerOptions({
      socket,
      userId,
      state,
      refs,
      isExpectedVoiceTeardownErrorFn,
      roundRateFn,
      coreRuntime,
    }),
  });
}
