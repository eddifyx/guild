export function createVoiceCaptureState({
  stream = null,
  requestedInputId = '',
  usedDefaultDeviceFallback = false,
  sourceTrack = null,
  reusedExistingStream = false,
} = {}) {
  return {
    disposed: false,
    stream,
    ownsStream: !reusedExistingStream,
    requestedInputId,
    usedDefaultDeviceFallback,
    sourceTrack,
    micCtx: null,
    gainNode: null,
    vadNode: null,
    outputTrack: null,
    outputTrackMode: null,
    routing: null,
    noiseSuppressorNode: null,
    residualDenoiserNode: null,
    noiseGateNode: null,
    speechFocusChain: null,
    keyboardSuppressorNode: null,
    appleVoiceFrameCleanup: null,
    appleVoiceStateCleanup: null,
    appleVoiceSourceNode: null,
    usesAppleVoiceProcessing: false,
  };
}

export function createVoiceFilterDiagnostics({
  suppressionRuntime = null,
  requestedSuppressionRuntime = null,
  noiseSuppressionEnabled = false,
  useRawMicPath = false,
} = {}) {
  return {
    backend: suppressionRuntime?.backend || null,
    requestedBackend: requestedSuppressionRuntime?.backend || null,
    suppressionEnabled: noiseSuppressionEnabled,
    loaded: useRawMicPath || !suppressionRuntime?.requiresWarmup,
    requiresWarmup: suppressionRuntime?.requiresWarmup ?? false,
    fallbackReason: suppressionRuntime?.fallbackReason ?? null,
  };
}

export function setVoiceCaptureOutputTrack(capture, {
  sourceTrack = null,
  destinationTrack = null,
  directSourceTrack = false,
  safeMode = false,
} = {}) {
  if (!capture) return null;

  if (safeMode) {
    capture.outputTrack = sourceTrack || null;
    capture.outputTrackMode = 'voice-safe-mode-direct-source';
  } else {
    capture.outputTrack = directSourceTrack
      ? (sourceTrack || destinationTrack || null)
      : (destinationTrack || sourceTrack || null);
    capture.outputTrackMode = directSourceTrack
      ? 'direct-source-hotfix'
      : 'processed-destination';
  }

  if (capture.outputTrack) {
    capture.outputTrack.enabled = true;
  }

  return capture.outputTrack;
}

export function ensureVoiceCaptureBypassRouting(capture, {
  micCtx,
  micSource,
  gainNode,
} = {}) {
  if (!capture || !micCtx || !micSource || !gainNode) {
    return null;
  }
  if (capture.routing) {
    return capture.routing;
  }

  const rawBypassGain = micCtx.createGain();
  const processedGain = micCtx.createGain();
  const processedMakeupGain = micCtx.createGain();
  rawBypassGain.gain.value = 1;
  processedGain.gain.value = 0;
  processedMakeupGain.gain.value = 1;

  capture.routing = {
    rawBypassGain,
    processedGain,
    processedMakeupGain,
    processedReady: false,
  };

  micSource.connect(rawBypassGain);
  rawBypassGain.connect(gainNode);
  processedGain.connect(processedMakeupGain);
  processedMakeupGain.connect(gainNode);

  return capture.routing;
}

export function buildVoiceCaptureDiagnostics({
  channelId = null,
  startedAt = null,
  mode = null,
  requestedConstraints = null,
  usedDefaultDeviceFallback = false,
  reusedSourceStream = false,
  sourceTrack = null,
  producedTrack = null,
  outputTrackMode = null,
  audioContext = null,
  filter = null,
  getUserMediaMs = null,
  audioGraphSetupMs = null,
  totalMs = null,
  error = undefined,
} = {}) {
  const diagnostics = {
    channelId,
    startedAt,
    mode,
    requestedConstraints,
    usedDefaultDeviceFallback,
    reusedSourceStream,
    sourceTrack,
    producedTrack,
    outputTrackMode,
    audioContext,
    filter,
    timingsMs: {
      getUserMedia: getUserMediaMs,
      audioGraphSetup: audioGraphSetupMs,
      total: totalMs,
    },
  };

  if (error !== undefined) {
    diagnostics.error = error;
  }

  return diagnostics;
}
