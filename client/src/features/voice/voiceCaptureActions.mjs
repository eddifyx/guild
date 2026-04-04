export function createVoiceCaptureActions({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  const {
    voiceMaxBitrate = 64_000,
    disableOpusDtx = false,
    voiceSafeMode = false,
  } = constants;

  function startVAD(gainNode) {
    refs.vadIntervalRef.current = runtime.startVoiceVadRuntimeFn({
      currentVadIntervalId: refs.vadIntervalRef.current,
      gainNode,
      mutedRef: refs.mutedRef,
      channelIdRef: refs.channelIdRef,
      socket: runtime.socket,
      setSpeakingFn: setters.setSpeakingFn,
      onError: runtime.onVadError,
    });
  }

  async function applyLiveCaptureToProducer({
    chId,
    sendTransport = refs.sendTransportRef?.current,
    perfTraceId = null,
  }) {
    return runtime.applyVoiceLiveCaptureProducerFn({
      chId,
      perfTraceId,
      refs: {
        liveCaptureConfigGenRef: refs.liveCaptureConfigGenRef,
        liveCaptureRef: refs.liveCaptureRef,
        producerRef: refs.producerRef,
        sendTransportRef: { current: sendTransport },
        channelIdRef: refs.channelIdRef,
        pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
        mutedRef: refs.mutedRef,
      },
      createLiveMicCaptureFn: ({ chId: nextChannelId, previousCapture }) => runtime.createLiveMicCaptureFn({
        chId: nextChannelId,
        mode: runtime.getStoredVoiceProcessingModeFn(),
        previousCapture,
      }),
      disposeLiveCaptureFn: runtime.disposeLiveCaptureFn,
      attachLiveCaptureProducerFn: ({ previousProducer, nextCapture, nextDiagnostics, sendTransport: activeSendTransport }) => (
        runtime.attachLiveCaptureProducerFn({
          previousProducer,
          nextCapture,
          nextDiagnostics,
          sendTransport: activeSendTransport,
          voiceMaxBitrate,
          disableOpusDtx,
          voiceSafeMode,
          getVoiceAudioBypassModeFn: runtime.getVoiceAudioBypassModeFn,
          applySenderPreferencesFn: runtime.applySenderPreferencesFn,
          attachSenderEncryptionFn: runtime.attachSenderEncryptionFn,
          roundMsFn: runtime.roundMsFn,
        })
      ),
      syncLiveCaptureRefsFn: runtime.syncLiveCaptureRefsFn,
      updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
      setLiveVoiceFallbackReasonFn: setters.setLiveVoiceFallbackReasonFn,
      startVadFn: startVAD,
      setMutedFn: setters.setMutedFn,
      addPerfPhaseFn: runtime.addPerfPhaseFn,
      endPerfTraceFn: runtime.endPerfTraceFn,
      cancelPerfTraceFn: runtime.cancelPerfTraceFn,
      normalizeVoiceErrorMessageFn: runtime.normalizeVoiceErrorMessageFn,
    });
  }

  async function reconfigureLiveCapture({ perfTraceId = null } = {}) {
    return runtime.reconfigureVoiceLiveCaptureFn({
      refs: {
        channelIdRef: refs.channelIdRef,
        pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
      },
      perfTraceId,
      addPerfPhaseFn: runtime.addPerfPhaseFn,
      endPerfTraceFn: runtime.endPerfTraceFn,
      cancelPerfTraceFn: runtime.cancelPerfTraceFn,
      applyLiveCaptureToProducerFn: applyLiveCaptureToProducer,
      normalizeVoiceErrorMessageFn: runtime.normalizeVoiceErrorMessageFn,
      warnFn: runtime.warnFn,
    });
  }

  function scheduleVoiceHealthProbe(chId, {
    delayMs = 2500,
    reason = 'join',
  } = {}) {
    return runtime.scheduleVoiceHealthProbeFlowFn({
      chId,
      delayMs,
      reason,
      refs: {
        voiceHealthProbeTimeoutRef: refs.voiceHealthProbeTimeoutRef,
        channelIdRef: refs.channelIdRef,
        mutedRef: refs.mutedRef,
        producerRef: refs.producerRef,
        voiceHealthProbeRetryCountRef: refs.voiceHealthProbeRetryCountRef,
      },
      clearVoiceHealthProbeFn: runtime.clearVoiceHealthProbeFn,
      setTimeoutFn: runtime.setTimeoutFn,
      runVoiceHealthProbeCheckFn: runtime.runVoiceHealthProbeCheckFn,
      summarizeProducerStatsFn: runtime.summarizeProducerStatsFn,
      updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
      reconfigureLiveCaptureFn: reconfigureLiveCapture,
      warnFn: runtime.warnFn,
      rescheduleFn: (nextChannelId, nextOptions) => scheduleVoiceHealthProbe(nextChannelId, nextOptions),
    });
  }

  return {
    startVAD,
    applyLiveCaptureToProducer,
    reconfigureLiveCapture,
    scheduleVoiceHealthProbe,
  };
}
