export function buildVoiceLiveCaptureRuntimeControllerOptions({
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

export function buildVoiceMediaActionControllerOptions({
  refs = {},
  runtime = {},
  deps = [],
} = {}) {
  return {
    refs,
    runtime,
    deps,
  };
}

export function buildVoiceMediaActionRuntime({
  setIncomingScreenSharesFn = () => {},
  listIncomingScreenSharesFn = () => [],
  setVoiceUserAudioEntryFn = () => {},
  ensureVoiceAudioHostFn = () => {},
  cleanupRemoteVoiceProducerFn = () => {},
  clearVoicePlaybackHooksFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
} = {}) {
  return {
    setIncomingScreenSharesFn,
    listIncomingScreenSharesFn,
    setVoiceUserAudioEntryFn,
    ensureVoiceAudioHostFn,
    cleanupRemoteVoiceProducerFn,
    clearVoicePlaybackHooksFn,
    updateVoiceDiagnosticsFn,
  };
}

export function buildVoiceSecurityActionControllerOptions({
  userId = null,
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return {
    userId,
    state,
    refs,
    runtime,
    constants,
    deps,
  };
}

export function buildVoiceSecurityActionRuntime({
  socket = null,
  getVoiceAudioBypassModeFn = () => null,
  getVoiceKeyFn = () => null,
  waitForVoiceKeyFn = async () => null,
  generateVoiceKeyFn = () => null,
  setVoiceKeyFn = () => {},
  clearVoiceKeyFn = () => {},
  distributeVoiceKeyFn = async () => {},
  flushPendingControlMessagesNowFn = async () => {},
  setVoiceChannelIdFn = () => {},
  setVoiceChannelParticipantsFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  isE2EInitializedFn = () => false,
  isInsertableStreamsSupportedFn = () => false,
} = {}) {
  return {
    socket,
    getVoiceAudioBypassModeFn,
    getVoiceKeyFn,
    waitForVoiceKeyFn,
    generateVoiceKeyFn,
    setVoiceKeyFn,
    clearVoiceKeyFn,
    distributeVoiceKeyFn,
    flushPendingControlMessagesNowFn,
    setVoiceChannelIdFn,
    setVoiceChannelParticipantsFn,
    updateVoiceDiagnosticsFn,
    isE2EInitializedFn,
    isInsertableStreamsSupportedFn,
  };
}

export function buildVoiceCaptureActionControllerOptions({
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

export function buildVoiceCaptureActionRuntime({
  socket = null,
  startVoiceVadRuntimeFn = () => {},
  onVadError = () => {},
  applyVoiceLiveCaptureProducerFn = () => {},
  createLiveMicCaptureFn = () => {},
  getStoredVoiceProcessingModeFn = () => null,
  disposeLiveCaptureFn = () => {},
  attachLiveCaptureProducerFn = () => {},
  getVoiceAudioBypassModeFn = () => null,
  attachSenderEncryptionFn = () => {},
  roundMsFn = (value) => value,
  syncLiveCaptureRefsFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  addPerfPhaseFn = () => {},
  endPerfTraceFn = () => {},
  cancelPerfTraceFn = () => {},
  normalizeVoiceErrorMessageFn = (value) => value,
  reconfigureVoiceLiveCaptureFn = () => {},
  warnFn = () => {},
  scheduleVoiceHealthProbeFlowFn = () => {},
  clearVoiceHealthProbeFn = () => {},
  setTimeoutFn = () => {},
  runVoiceHealthProbeCheckFn = () => {},
  summarizeProducerStatsFn = () => null,
} = {}) {
  return {
    socket,
    startVoiceVadRuntimeFn,
    onVadError,
    applyVoiceLiveCaptureProducerFn,
    createLiveMicCaptureFn,
    getStoredVoiceProcessingModeFn,
    disposeLiveCaptureFn,
    attachLiveCaptureProducerFn,
    getVoiceAudioBypassModeFn,
    attachSenderEncryptionFn,
    roundMsFn,
    syncLiveCaptureRefsFn,
    updateVoiceDiagnosticsFn,
    addPerfPhaseFn,
    endPerfTraceFn,
    cancelPerfTraceFn,
    normalizeVoiceErrorMessageFn,
    reconfigureVoiceLiveCaptureFn,
    warnFn,
    scheduleVoiceHealthProbeFlowFn,
    clearVoiceHealthProbeFn,
    setTimeoutFn,
    runVoiceHealthProbeCheckFn,
    summarizeProducerStatsFn,
  };
}
