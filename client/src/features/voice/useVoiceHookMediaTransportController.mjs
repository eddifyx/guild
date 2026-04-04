import { useVoiceHookMediaTransportControllerRuntime } from './useVoiceHookMediaTransportControllerRuntime.mjs';
import { buildUseVoiceHookMediaTransportControllerOptions } from './voiceHookControllerBindings.mjs';
import { buildUseVoiceHookMediaTransportRuntime } from './voiceHookControllerRuntimeBindings.mjs';
import { buildUseVoiceHookMediaTransportRuntimeDeps } from './voiceHookControllerRuntimeDeps.mjs';

export function useVoiceHookMediaTransportController({
  socket = null,
  currentUserId = null,
  state = {},
  refs = {},
  emitAsyncFn,
  recordLaneDiagnosticFn,
  updateVoiceDiagnosticsFn,
  resetScreenShareAdaptationFn,
  playStreamStopChimeFn,
  getPrimaryCodecMimeTypeFromRtpParametersFn,
  getExperimentalScreenVideoBypassModeFn,
  summarizeReceiverVideoCodecSupportFn,
} = {}) {
  return useVoiceHookMediaTransportControllerRuntime(buildUseVoiceHookMediaTransportControllerOptions({
    socket,
    currentUserId,
    state,
    refs,
    runtime: buildUseVoiceHookMediaTransportRuntime(buildUseVoiceHookMediaTransportRuntimeDeps({
      emitAsyncFn,
      recordLaneDiagnosticFn,
      updateVoiceDiagnosticsFn,
      resetScreenShareAdaptationFn,
      playStreamStopChimeFn,
      getPrimaryCodecMimeTypeFromRtpParametersFn,
      getExperimentalScreenVideoBypassModeFn,
      summarizeReceiverVideoCodecSupportFn,
    })),
  }));
}
