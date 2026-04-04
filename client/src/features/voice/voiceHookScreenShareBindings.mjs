export function buildVoiceScreenShareRuntimeControllerOptions({
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return {
    state,
    refs,
    runtime,
    constants,
    deps,
  };
}

export function buildVoiceScreenShareActionControllerOptions({
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return {
    state,
    refs,
    runtime,
    constants,
    deps,
  };
}

export function buildVoiceScreenShareActionRuntime({
  ensureSecureMediaReadyFn = async () => true,
  ensureVoiceKeyForParticipantsFn = async () => true,
  getOrCreateScreenSendTransportFn = async () => null,
  getRuntimeScreenShareCodecModeFn = () => null,
  getPreferredScreenShareCodecCandidatesFn = () => [],
  resetScreenShareAdaptationFn = () => {},
  applyPreferredScreenShareConstraintsFn = () => {},
  playStreamStartChimeFn = () => {},
  cleanupVoiceScreenShareSessionFn = () => {},
  publishScreenShareVideoProducerFn = async () => null,
  applySenderPreferencesFn = async () => {},
  attachSenderEncryptionFn = () => {},
  socket = null,
  onVideoTrackEndedFn = () => {},
  buildScreenShareStartErrorFn = () => null,
  logScreenShareFailureContextFn = () => {},
  summarizeSelectedCodecFn = () => null,
  summarizeTrackSnapshotFn = () => null,
  summarizeScreenShareProfileFn = () => null,
  summarizeScreenShareHardwareFn = () => null,
  summarizeSenderParametersFn = () => null,
  getScreenShareRequestedCaptureFn = () => null,
  getPlatformFn = () => null,
  runVoiceScreenShareStartFlowFn = async () => null,
} = {}) {
  return {
    ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn,
    getRuntimeScreenShareCodecModeFn,
    getPreferredScreenShareCodecCandidatesFn,
    resetScreenShareAdaptationFn,
    applyPreferredScreenShareConstraintsFn,
    playStreamStartChimeFn,
    cleanupVoiceScreenShareSessionFn,
    publishScreenShareVideoProducerFn,
    applySenderPreferencesFn,
    attachSenderEncryptionFn,
    socket,
    onVideoTrackEndedFn,
    buildScreenShareStartErrorFn,
    logScreenShareFailureContextFn,
    summarizeSelectedCodecFn,
    summarizeTrackSnapshotFn,
    summarizeScreenShareProfileFn,
    summarizeScreenShareHardwareFn,
    summarizeSenderParametersFn,
    getScreenShareRequestedCaptureFn,
    getPlatformFn,
    runVoiceScreenShareStartFlowFn,
  };
}
