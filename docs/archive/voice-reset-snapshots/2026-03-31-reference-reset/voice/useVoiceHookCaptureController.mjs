import { useVoiceHookCaptureControllerRuntime } from './useVoiceHookCaptureControllerRuntime.mjs';
import { buildUseVoiceHookCaptureControllerOptions } from './voiceHookControllerBindings.mjs';
import { buildUseVoiceHookCaptureRuntime } from './voiceHookControllerRuntimeBindings.mjs';
import { buildUseVoiceHookCaptureRuntimeDeps } from './voiceHookControllerRuntimeDeps.mjs';

export function useVoiceHookCaptureController({
  socket = null,
  state = {},
  refs = {},
  applyNoiseSuppressionRoutingFn,
  updateVoiceDiagnosticsFn,
  applySenderPreferencesFn,
  getVoiceAudioBypassModeFn,
} = {}) {
  return useVoiceHookCaptureControllerRuntime(buildUseVoiceHookCaptureControllerOptions({
    socket,
    state,
    refs,
    runtime: buildUseVoiceHookCaptureRuntime(buildUseVoiceHookCaptureRuntimeDeps({
      applyNoiseSuppressionRoutingFn,
      updateVoiceDiagnosticsFn,
      applySenderPreferencesFn,
      getVoiceAudioBypassModeFn,
    })),
  }));
}
