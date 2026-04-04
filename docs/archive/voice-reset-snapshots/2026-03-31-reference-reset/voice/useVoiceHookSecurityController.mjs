import { useVoiceHookSecurityControllerRuntime } from './useVoiceHookSecurityControllerRuntime.mjs';
import { buildUseVoiceHookSecurityControllerOptions } from './voiceHookControllerBindings.mjs';
import { buildUseVoiceHookSecurityRuntime } from './voiceHookControllerRuntimeBindings.mjs';
import { buildUseVoiceHookSecurityRuntimeDeps } from './voiceHookControllerRuntimeDeps.mjs';

export function useVoiceHookSecurityController({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  clearVoiceKeyFn,
  updateVoiceDiagnosticsFn,
} = {}) {
  return useVoiceHookSecurityControllerRuntime(buildUseVoiceHookSecurityControllerOptions({
    socket,
    userId,
    state,
    refs,
    runtime: buildUseVoiceHookSecurityRuntime(buildUseVoiceHookSecurityRuntimeDeps({
      clearVoiceKeyFn,
      updateVoiceDiagnosticsFn,
    })),
  }));
}
