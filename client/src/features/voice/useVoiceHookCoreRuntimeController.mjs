import { useVoiceHookCaptureController } from './useVoiceHookCaptureController.mjs';
import { useVoiceHookMediaTransportController } from './useVoiceHookMediaTransportController.mjs';
import { useVoiceHookSecurityController } from './useVoiceHookSecurityController.mjs';
import { useVoiceHookScreenShareController } from './useVoiceHookScreenShareController.mjs';
import {
  buildUseVoiceHookCaptureRuntimeInput,
  buildUseVoiceHookCoreRuntimeValue,
  buildUseVoiceHookMediaTransportRuntimeInput,
  buildUseVoiceHookScreenShareRuntimeInput,
  buildUseVoiceHookSecurityRuntimeInput,
  syncUseVoiceHookCoreRuntimeDeps,
} from './voiceHookCoreRuntimeControllerInputs.mjs';

export function useVoiceHookCoreRuntimeController({
  socket = null,
  userId = null,
  state = {},
  refs = {},
  clearVoiceKeyFn,
  updateVoiceDiagnosticsFn,
  applyNoiseSuppressionRoutingFn,
  applySenderPreferencesFn,
  getVoiceAudioBypassModeFn,
  emitAsyncFn,
  recordLaneDiagnosticFn,
  playStreamStopChimeFn,
  getPrimaryCodecMimeTypeFromRtpParametersFn,
  getExperimentalScreenVideoBypassModeFn,
  summarizeReceiverVideoCodecSupportFn,
} = {}) {
  const screenShare = useVoiceHookScreenShareController(buildUseVoiceHookScreenShareRuntimeInput({
    socket,
    state,
    refs,
  }));

  const security = useVoiceHookSecurityController(buildUseVoiceHookSecurityRuntimeInput({
    socket,
    userId,
    state,
    refs,
    clearVoiceKeyFn,
    updateVoiceDiagnosticsFn,
  }));

  const capture = useVoiceHookCaptureController(buildUseVoiceHookCaptureRuntimeInput({
    socket,
    state,
    refs,
    applyNoiseSuppressionRoutingFn,
    updateVoiceDiagnosticsFn,
    applySenderPreferencesFn,
    getVoiceAudioBypassModeFn,
  }));

  const mediaTransport = useVoiceHookMediaTransportController(buildUseVoiceHookMediaTransportRuntimeInput({
    socket,
    userId,
    state,
    refs,
    emitAsyncFn,
    recordLaneDiagnosticFn,
    updateVoiceDiagnosticsFn,
    resetScreenShareAdaptationFn: screenShare.resetScreenShareAdaptation,
    playStreamStopChimeFn,
    getPrimaryCodecMimeTypeFromRtpParametersFn,
    getExperimentalScreenVideoBypassModeFn,
    summarizeReceiverVideoCodecSupportFn,
  }));

  syncUseVoiceHookCoreRuntimeDeps({
    screenShare,
    security,
    mediaTransport,
  });

  return buildUseVoiceHookCoreRuntimeValue({
    screenShare,
    security,
    capture,
    mediaTransport,
  });
}
