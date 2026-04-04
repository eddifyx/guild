export function buildVoiceResetSessionOptions({
  targetChannelId = null,
  notifyServer = false,
  socket = null,
  emitAsyncFn = async () => {},
  clearVoiceHealthProbeFn = () => {},
  stopAppleVoiceCaptureFn = () => {},
  appleVoiceCaptureOwner = null,
  refs = {},
  resetScreenShareAdaptationFn = () => {},
  clearVoiceKeyFn = () => {},
  setters = {},
  updateVoiceDiagnosticsFn = () => {},
  resetControlState = {},
} = {}) {
  return {
    targetChannelId,
    notifyServer,
    socket,
    emitAsyncFn,
    clearVoiceHealthProbeFn,
    stopAppleVoiceCaptureFn,
    appleVoiceCaptureOwner,
    refs,
    resetScreenShareAdaptationFn,
    clearVoiceKeyFn,
    setShowSourcePickerFn: setters.setShowSourcePickerFn,
    setScreenSharingFn: setters.setScreenSharingFn,
    setScreenShareStreamFn: setters.setScreenShareStreamFn,
    setScreenShareErrorFn: setters.setScreenShareErrorFn,
    setScreenShareDiagnosticsFn: setters.setScreenShareDiagnosticsFn,
    setIncomingScreenSharesFn: setters.setIncomingScreenSharesFn,
    setChannelIdFn: setters.setChannelIdFn,
    setVoiceChannelIdFn: setters.setVoiceChannelIdFn,
    setVoiceChannelParticipantsFn: setters.setVoiceChannelParticipantsFn,
    setJoinErrorFn: setters.setJoinErrorFn,
    setVoiceE2EFn: setters.setVoiceE2EFn,
    setE2EWarningFn: setters.setE2EWarningFn,
    setLiveVoiceFallbackReasonFn: setters.setLiveVoiceFallbackReasonFn,
    updateVoiceDiagnosticsFn,
    setMutedFn: setters.setMutedFn,
    setDeafenedFn: setters.setDeafenedFn,
    setSpeakingFn: setters.setSpeakingFn,
    setPeersFn: setters.setPeersFn,
    resetControlState,
  };
}

export function buildVoiceConsumeProducerOptions({
  chId,
  producerId,
  producerUserId,
  source = null,
  currentUserId = null,
  refs = {},
  runtime = {},
} = {}) {
  return {
    chId,
    producerId,
    producerUserId,
    source,
    currentUserId,
    refs,
    emitAsyncFn: runtime.emitAsyncFn,
    recordLaneDiagnosticFn: runtime.recordLaneDiagnosticFn,
    getPrimaryCodecMimeTypeFromRtpParametersFn: runtime.getPrimaryCodecMimeTypeFromRtpParametersFn,
    getExperimentalScreenVideoBypassModeFn: runtime.getExperimentalScreenVideoBypassModeFn,
    getVoiceAudioBypassModeFn: runtime.getVoiceAudioBypassModeFn,
    attachReceiverDecryptionFn: runtime.attachReceiverDecryptionFn,
    cleanupRemoteProducerFn: runtime.cleanupRemoteProducerFn,
    syncIncomingScreenSharesFn: runtime.syncIncomingScreenSharesFn,
    updateVoiceDiagnosticsFn: runtime.updateVoiceDiagnosticsFn,
    summarizeTrackSnapshotFn: runtime.summarizeTrackSnapshotFn,
    summarizeReceiverVideoCodecSupportFn: runtime.summarizeReceiverVideoCodecSupportFn,
    mountRemoteAudioElementFn: runtime.mountRemoteAudioElementFn,
    applyVoiceOutputDeviceFn: runtime.applyVoiceOutputDeviceFn,
    readStoredVoiceOutputDeviceIdFn: runtime.readStoredVoiceOutputDeviceIdFn,
    setUserAudioEntryFn: runtime.setUserAudioEntryFn,
    readStoredUserVolumeFn: runtime.readStoredUserVolumeFn,
    attachVoiceConsumerPlaybackRuntimeFn: runtime.attachVoiceConsumerPlaybackRuntimeFn,
    buildPlaybackErrorMessageFn: runtime.buildPlaybackErrorMessageFn,
    mediaStreamCtor: runtime.mediaStreamCtor,
    audioCtor: runtime.audioCtor,
    roundMsFn: runtime.roundMsFn,
    performanceNowFn: runtime.performanceNowFn,
    nowIsoFn: runtime.nowIsoFn,
  };
}

export function buildVoiceJoinRequestOptions({
  chId,
  skipConnectChime = false,
  socket = null,
  refs = {},
  runtime = {},
} = {}) {
  return {
    chId,
    skipConnectChime,
    socket,
    refs,
    setJoinErrorFn: runtime.setJoinErrorFn,
    setE2EWarningFn: runtime.setE2EWarningFn,
    setLiveVoiceFallbackReasonFn: runtime.setLiveVoiceFallbackReasonFn,
    recordLaneDiagnosticFn: runtime.recordLaneDiagnosticFn,
    runVoiceJoinFlowFn: runtime.runVoiceJoinFlowFn,
    ensureSecureMediaReadyFn: runtime.ensureSecureMediaReadyFn,
    resetVoiceSessionFn: runtime.resetVoiceSessionFn,
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
    isExpectedVoiceTeardownErrorFn: runtime.isExpectedVoiceTeardownErrorFn,
    normalizeVoiceErrorMessageFn: runtime.normalizeVoiceErrorMessageFn,
    scheduleClearJoinErrorFn: runtime.scheduleClearJoinErrorFn,
    logErrorFn: runtime.logErrorFn,
  };
}

export function buildVoiceSessionActionOptions({
  socket = null,
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
} = {}) {
  return {
    socket,
    refs,
    setters,
    runtime,
    constants,
  };
}

export function buildVoiceUiActionOptions({
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  return {
    refs,
    setters,
    runtime,
  };
}

export function buildVoiceScreenShareActionOptions({
  refs = {},
  runtime = {},
  constants = {},
  getPlatformFn = () => null,
  runVoiceScreenShareStartFlowFn = async () => {},
  windowObject = globalThis.window,
  navigatorObject = globalThis.navigator,
  consoleObject = globalThis.console,
} = {}) {
  return {
    refs,
    runtime,
    constants,
    getPlatformFn,
    runVoiceScreenShareStartFlowFn,
    windowObject,
    navigatorObject,
    consoleObject,
  };
}

export function buildUseVoiceRuntimeEffectsOptions({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  return {
    state,
    refs,
    runtime,
  };
}
