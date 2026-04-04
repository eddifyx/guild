import { useVoiceSessionActionController } from './useVoiceSessionActionController.mjs';
import {
  buildVoiceSessionActionControllerOptions,
  buildVoiceSessionActionRuntime,
  buildVoiceSessionJoinRuntime,
} from './voiceHookBindings.mjs';

export function useVoiceHookSessionControllerRuntime({
  socket = null,
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  const resolvedConstants = Object.keys(constants || {}).length > 0
    ? constants
    : (runtime.constants || {});
  const resolvedDeps = Array.isArray(deps) && deps.length > 0
    ? deps
    : (Array.isArray(runtime.deps) ? runtime.deps : []);

  return useVoiceSessionActionController(
    buildVoiceSessionActionControllerOptions({
      socket,
      state,
      refs,
      runtime: buildVoiceSessionActionRuntime({
        emitAsyncFn: runtime.emitAsyncFn,
        clearVoiceHealthProbeFn: runtime.clearVoiceHealthProbeFn,
        stopAppleVoiceCaptureFn: runtime.stopAppleVoiceCaptureFn,
        resetScreenShareAdaptationFn: runtime.resetScreenShareAdaptationFn,
        clearVoiceKeyFn: runtime.clearVoiceKeyFn,
        updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
        setVoiceChannelIdFn: runtime.setVoiceChannelIdFn,
        setVoiceChannelParticipantsFn: runtime.setVoiceChannelParticipantsFn,
        advanceJoinGenerationFn: runtime.advanceJoinGenerationFn,
        setTimeoutFn: runtime.setTimeoutFn,
        playLeaveChimeFn: runtime.playLeaveChimeFn,
        clearTimeoutFn: runtime.clearTimeoutFn,
        cancelPerfTraceFn: runtime.cancelPerfTraceFn,
        joinRuntime: buildVoiceSessionJoinRuntime({
          setJoinErrorFn: runtime.setJoinErrorFn,
          setE2EWarningFn: runtime.setE2EWarningFn,
          setLiveVoiceFallbackReasonFn: runtime.setLiveVoiceFallbackReasonFn,
          recordLaneDiagnosticFn: runtime.recordLaneDiagnosticFn,
          ensureSecureMediaReadyFn: runtime.ensureSecureMediaReadyFn,
          emitAsyncFn: runtime.emitAsyncFn,
          rememberUsersFn: runtime.rememberUsersFn,
          getUntrustedVoiceParticipantsFn: runtime.getUntrustedVoiceParticipantsFn,
          buildVoiceTrustErrorFn: runtime.buildVoiceTrustErrorFn,
          deviceCtor: runtime.deviceCtor,
          setDeviceFn: runtime.setDeviceFn,
          createSendTransportFn: runtime.createSendTransportFn,
          createRecvTransportFn: runtime.createRecvTransportFn,
          setChannelIdFn: runtime.setChannelIdFn,
          setDeafenedFn: runtime.setDeafenedFn,
          setVoiceChannelIdFn: runtime.setVoiceChannelIdFn,
          syncVoiceParticipantsFn: runtime.syncVoiceParticipantsFn,
          getVoiceParticipantIdsFn: runtime.getVoiceParticipantIdsFn,
          updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
          consumeProducerFn: runtime.consumeProducerFn,
          syncVoiceE2EStateFn: runtime.syncVoiceE2EStateFn,
          playConnectChimeFn: runtime.playConnectChimeFn,
          getPlatformFn: runtime.getPlatformFn,
          prefetchDesktopSourcesFn: runtime.prefetchDesktopSourcesFn,
          applyLiveCaptureToProducerFn: runtime.applyLiveCaptureToProducerFn,
          setMutedFn: runtime.setMutedFn,
          clearVoiceHealthProbeFn: runtime.clearVoiceHealthProbeFn,
          scheduleVoiceHealthProbeFn: runtime.scheduleVoiceHealthProbeFn,
          resumeVoiceMediaAfterKeyUpdateFn: runtime.resumeVoiceMediaAfterKeyUpdateFn,
          getCurrentVoiceKeyFn: runtime.getCurrentVoiceKeyFn,
          isExpectedVoiceTeardownErrorFn: runtime.isExpectedVoiceTeardownErrorFn,
          normalizeVoiceErrorMessageFn: runtime.normalizeVoiceErrorMessageFn,
          scheduleClearJoinErrorFn: runtime.scheduleClearJoinErrorFn,
          logErrorFn: runtime.logErrorFn,
        }),
      }),
      constants: resolvedConstants,
      deps: resolvedDeps,
    })
  );
}
