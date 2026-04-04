export async function resetVoiceSessionRuntime({
  targetChannelId = null,
  notifyServer = false,
  socket = null,
  emitAsyncFn = async () => {},
  clearVoiceHealthProbeFn = () => {},
  clearTimeoutFn = globalThis.clearTimeout,
  clearIntervalFn = globalThis.clearInterval,
  stopAppleVoiceCaptureFn = async () => {},
  appleVoiceCaptureOwner = null,
  nowIsoFn = () => new Date().toISOString(),
  refs = {},
  resetScreenShareAdaptationFn = () => {},
  clearVoiceKeyFn = () => {},
  setShowSourcePickerFn = () => {},
  setScreenSharingFn = () => {},
  setScreenShareStreamFn = () => {},
  setScreenShareErrorFn = () => {},
  setScreenShareDiagnosticsFn = () => {},
  setIncomingScreenSharesFn = () => {},
  setChannelIdFn = () => {},
  setVoiceChannelIdFn = () => {},
  setVoiceChannelParticipantsFn = () => {},
  setJoinErrorFn = () => {},
  setVoiceE2EFn = () => {},
  setE2EWarningFn = () => {},
  setLiveVoiceFallbackReasonFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  setMutedFn = () => {},
  setDeafenedFn = () => {},
  setSpeakingFn = () => {},
  setPeersFn = () => {},
  resetControlState = {
    muted: true,
    deafened: false,
    mutedBeforeDeafen: true,
    speaking: false,
  },
} = {}) {
  const {
    voiceHealthProbeRetryCountRef,
    pendingLiveReconfigureRef,
    liveCaptureConfigGenRef,
    vadIntervalRef,
    noiseSuppressorNodeRef,
    residualDenoiserNodeRef,
    noiseGateNodeRef,
    speechFocusChainRef,
    keyboardSuppressorNodeRef,
    noiseSuppressionRoutingRef,
    appleVoiceFrameCleanupRef,
    appleVoiceStateCleanupRef,
    appleVoiceSourceNodeRef,
    micAudioCtxRef,
    micGainNodeRef,
    localStreamRef,
    screenShareAudioProducerRef,
    screenShareProducerRef,
    screenShareStreamRef,
    screenShareStatsRef,
    screenShareVideosRef,
    producerRef,
    consumersRef,
    producerUserMapRef,
    producerMetaRef,
    audioElementsRef,
    userAudioRef,
    sendTransportRef,
    screenSendTransportRef,
    recvTransportRef,
    deviceRef,
    liveCaptureRef,
    participantIdsRef,
    channelIdRef,
    mutedBeforeDeafenRef,
    pendingSecureVoiceJoinRef,
  } = refs;

  clearVoiceHealthProbeFn();
  if (voiceHealthProbeRetryCountRef) {
    voiceHealthProbeRetryCountRef.current = 0;
  }
  if (pendingLiveReconfigureRef?.current) {
    clearTimeoutFn?.(pendingLiveReconfigureRef.current);
    pendingLiveReconfigureRef.current = null;
  }
  if (liveCaptureConfigGenRef) {
    liveCaptureConfigGenRef.current += 1;
  }

  if (vadIntervalRef?.current) {
    clearIntervalFn?.(vadIntervalRef.current);
    vadIntervalRef.current = null;
  }

  if (noiseSuppressorNodeRef?.current) {
    try { noiseSuppressorNodeRef.current.destroy?.(); } catch {}
    try { noiseSuppressorNodeRef.current.disconnect?.(); } catch {}
    noiseSuppressorNodeRef.current = null;
  }
  if (residualDenoiserNodeRef?.current) {
    try { residualDenoiserNodeRef.current.destroy?.(); } catch {}
    try { residualDenoiserNodeRef.current.disconnect?.(); } catch {}
    residualDenoiserNodeRef.current = null;
  }
  if (noiseGateNodeRef?.current) {
    try { noiseGateNodeRef.current.disconnect?.(); } catch {}
    noiseGateNodeRef.current = null;
  }
  if (speechFocusChainRef?.current) {
    try { speechFocusChainRef.current.disconnect?.(); } catch {}
    speechFocusChainRef.current = null;
  }
  if (keyboardSuppressorNodeRef?.current) {
    try { keyboardSuppressorNodeRef.current.disconnect?.(); } catch {}
    keyboardSuppressorNodeRef.current = null;
  }
  if (noiseSuppressionRoutingRef) {
    noiseSuppressionRoutingRef.current = null;
  }

  if (appleVoiceFrameCleanupRef?.current) {
    try { appleVoiceFrameCleanupRef.current(); } catch {}
    appleVoiceFrameCleanupRef.current = null;
  }
  if (appleVoiceStateCleanupRef?.current) {
    try { appleVoiceStateCleanupRef.current(); } catch {}
    appleVoiceStateCleanupRef.current = null;
  }
  if (appleVoiceSourceNodeRef?.current) {
    try { appleVoiceSourceNodeRef.current.port.postMessage({ type: 'reset' }); } catch {}
    try { appleVoiceSourceNodeRef.current.disconnect?.(); } catch {}
    appleVoiceSourceNodeRef.current = null;
  }
  if (stopAppleVoiceCaptureFn && appleVoiceCaptureOwner) {
    try {
      await stopAppleVoiceCaptureFn(appleVoiceCaptureOwner);
    } catch {}
  }

  if (micAudioCtxRef?.current) {
    micAudioCtxRef.current.close().catch(() => {});
    micAudioCtxRef.current = null;
    if (micGainNodeRef) {
      micGainNodeRef.current = null;
    }
  }

  if (localStreamRef?.current) {
    localStreamRef.current.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }

  if (screenShareAudioProducerRef?.current) {
    screenShareAudioProducerRef.current.close();
    screenShareAudioProducerRef.current = null;
  }
  if (screenShareProducerRef?.current) {
    screenShareProducerRef.current.close();
    screenShareProducerRef.current = null;
  }
  if (screenShareStreamRef?.current) {
    screenShareStreamRef.current.getTracks().forEach((track) => track.stop());
    screenShareStreamRef.current = null;
  }
  setShowSourcePickerFn(false);
  setScreenSharingFn(false);
  setScreenShareStreamFn(null);
  setScreenShareErrorFn(null);
  if (screenShareStatsRef) {
    screenShareStatsRef.current = null;
  }
  resetScreenShareAdaptationFn();
  setScreenShareDiagnosticsFn(null);
  screenShareVideosRef?.current?.clear?.();
  setIncomingScreenSharesFn([]);

  if (producerRef?.current) {
    producerRef.current.close();
    producerRef.current = null;
  }

  if (consumersRef?.current) {
    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }
    consumersRef.current.clear();
  }
  producerUserMapRef?.current?.clear?.();
  producerMetaRef?.current?.clear?.();

  if (audioElementsRef?.current) {
    for (const audio of audioElementsRef.current.values()) {
      try { audio._voiceRetryCleanup?.(); } catch {}
      try { audio._voiceMediaCleanup?.(); } catch {}
      audio.pause();
      audio.srcObject = null;
      if (audio.parentNode) {
        audio.parentNode.removeChild(audio);
      }
    }
    audioElementsRef.current.clear();
  }
  userAudioRef?.current?.clear?.();

  if (sendTransportRef?.current) {
    sendTransportRef.current.close();
    sendTransportRef.current = null;
  }
  if (screenSendTransportRef?.current) {
    screenSendTransportRef.current.close();
    screenSendTransportRef.current = null;
  }
  if (recvTransportRef?.current) {
    recvTransportRef.current.close();
    recvTransportRef.current = null;
  }

  if (deviceRef) {
    deviceRef.current = null;
  }
  if (liveCaptureRef) {
    liveCaptureRef.current = null;
  }
  if (participantIdsRef) {
    participantIdsRef.current = [];
  }
  if (channelIdRef) {
    channelIdRef.current = null;
  }
  if (pendingSecureVoiceJoinRef) {
    pendingSecureVoiceJoinRef.current = null;
  }
  setChannelIdFn(null);
  clearVoiceKeyFn();
  setVoiceChannelIdFn(null);
  setVoiceChannelParticipantsFn([]);
  setJoinErrorFn(null);
  setVoiceE2EFn(false);
  setE2EWarningFn(null);
  setLiveVoiceFallbackReasonFn(null);
  updateVoiceDiagnosticsFn((prev) => ({
    ...prev,
    session: {
      ...(prev.session || {}),
      active: false,
      channelId: targetChannelId || null,
      endedAt: nowIsoFn(),
    },
    senderStats: null,
    screenShare: null,
    consumers: {},
  }));

  if (notifyServer && targetChannelId && socket) {
    try { await emitAsyncFn('voice:leave', { channelId: targetChannelId }); } catch {}
  }

  setMutedFn(resetControlState.muted);
  setDeafenedFn(resetControlState.deafened);
  if (mutedBeforeDeafenRef) {
    mutedBeforeDeafenRef.current = resetControlState.mutedBeforeDeafen;
  }
  setSpeakingFn(resetControlState.speaking);
  setPeersFn({});
}
