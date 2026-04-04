import {
  buildVoiceJoinRequestOptions,
  buildVoiceResetSessionOptions,
} from './voiceControllerBindings.mjs';
import {
  handleUnexpectedVoiceSessionEnd as handleUnexpectedVoiceSessionEndInFlow,
  leaveVoiceChannelSession,
  runVoiceJoinRequest,
} from './voiceSessionControlFlow.mjs';
import { resetVoiceSessionRuntime } from './voiceSessionResetRuntime.mjs';

export function createVoiceSessionActions({
  socket = null,
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  const {
    voiceSessionErrorTimeoutMs = 8000,
    appleVoiceCaptureOwner = null,
    resetControlState = {},
  } = constants;

  async function resetVoiceSession({
    channelId: targetChannelId = refs.channelIdRef?.current,
    notifyServer = false,
  } = {}) {
    return resetVoiceSessionRuntime(buildVoiceResetSessionOptions({
      targetChannelId,
      notifyServer,
      socket,
      emitAsyncFn: runtime.emitAsyncFn,
      clearVoiceHealthProbeFn: runtime.clearVoiceHealthProbeFn,
      stopAppleVoiceCaptureFn: runtime.stopAppleVoiceCaptureFn,
      appleVoiceCaptureOwner,
      refs,
      resetScreenShareAdaptationFn: runtime.resetScreenShareAdaptationFn,
      clearVoiceKeyFn: runtime.clearVoiceKeyFn,
      setters,
      updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
      resetControlState,
    }));
  }

  async function handleUnexpectedVoiceSessionEnd(message, {
    channelId: targetChannelId = refs.channelIdRef?.current,
  } = {}) {
    const hasVoiceSession = Boolean(
      targetChannelId
      || refs.deviceRef?.current
      || refs.sendTransportRef?.current
      || refs.recvTransportRef?.current
      || refs.producerRef?.current
      || refs.screenSendTransportRef?.current
      || refs.screenShareProducerRef?.current
      || refs.screenShareStreamRef?.current
    );
    return handleUnexpectedVoiceSessionEndInFlow(message, {
      targetChannelId,
      hasVoiceSession,
      advanceJoinGenerationFn: runtime.advanceJoinGenerationFn,
      resetVoiceSessionFn: resetVoiceSession,
      setJoinErrorFn: setters.setJoinErrorFn,
      setTimeoutFn: runtime.setTimeoutFn,
      sessionErrorTimeoutMs: voiceSessionErrorTimeoutMs,
    });
  }

  async function joinChannel(chId, { skipConnectChime = false } = {}) {
    const joinResult = await runVoiceJoinRequest(buildVoiceJoinRequestOptions({
      chId,
      skipConnectChime,
      socket,
      refs: {
        joinGenRef: refs.joinGenRef,
        channelIdRef: refs.channelIdRef,
        voiceHealthProbeRetryCountRef: refs.voiceHealthProbeRetryCountRef,
      },
      runtime: {
        ...runtime.joinRuntime,
        resetVoiceSessionFn: resetVoiceSession,
      },
    }));
    if (refs.pendingSecureVoiceJoinRef) {
      if (joinResult?.aborted || joinResult?.reason !== 'secure_voice_unavailable') {
        refs.pendingSecureVoiceJoinRef.current = null;
      } else {
        refs.pendingSecureVoiceJoinRef.current = {
          channelId: chId,
          existingProducers: Array.isArray(joinResult.existingProducers)
            ? joinResult.existingProducers
            : [],
          forcedMutedForSecureVoice: true,
        };
        if (
          runtime.joinRuntime?.getCurrentVoiceKeyFn?.()
          && typeof runtime.joinRuntime?.resumeVoiceMediaAfterKeyUpdateFn === 'function'
        ) {
          await runtime.joinRuntime.resumeVoiceMediaAfterKeyUpdateFn({
            channelId: chId,
          });
        }
      }
    }
    return joinResult;
  }

  async function leaveChannel() {
    return leaveVoiceChannelSession({
      refs: {
        pendingLiveReconfigureRef: refs.pendingLiveReconfigureRef,
        pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
        joinGenRef: refs.joinGenRef,
      },
      setJoinErrorFn: setters.setJoinErrorFn,
      resetVoiceSessionFn: resetVoiceSession,
      playLeaveChimeFn: runtime.playLeaveChimeFn,
      clearTimeoutFn: runtime.clearTimeoutFn,
      cancelPerfTraceFn: runtime.cancelPerfTraceFn,
    });
  }

  return {
    resetVoiceSession,
    handleUnexpectedVoiceSessionEnd,
    joinChannel,
    leaveChannel,
  };
}
