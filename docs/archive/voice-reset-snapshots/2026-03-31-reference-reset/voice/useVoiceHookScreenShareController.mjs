import { useVoiceHookScreenShareControllerRuntime } from './useVoiceHookScreenShareControllerRuntime.mjs';
import { buildUseVoiceHookScreenShareControllerOptions } from './voiceHookControllerBindings.mjs';
import { useVoiceHookScreenShareBridgeController } from './useVoiceHookScreenShareBridgeController.mjs';

export function useVoiceHookScreenShareController({
  socket = null,
  state = {},
  refs = {},
} = {}) {
  const {
    deferredScreenShareRuntime,
    syncScreenShareRuntimeDeps,
  } = useVoiceHookScreenShareBridgeController();

  return {
    ...useVoiceHookScreenShareControllerRuntime(buildUseVoiceHookScreenShareControllerOptions({
      socket,
      state,
      refs,
      runtime: deferredScreenShareRuntime,
    })),
    syncScreenShareRuntimeDeps,
  };
}
