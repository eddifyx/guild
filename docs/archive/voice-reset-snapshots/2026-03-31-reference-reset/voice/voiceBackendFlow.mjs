export async function startVoiceCaptureBackend({
  capture = null,
  micSource = null,
  gainNode = null,
  useRawMicPath = false,
  suppressionRuntime = null,
  activeVoiceProcessingMode = null,
  noiseSuppressionEnabled = false,
  requestedSuppressionRuntime = null,
  filterDiagnostics = {},
  appleVoiceAvailableRef = { current: true },
  startAppleProcessingLaneFn = async () => ({ workletCreateMs: null }),
  startRnnoiseProcessingLaneFn = async () => ({ workletCreateMs: null }),
  cleanupAppleLaneFn = async () => {},
  shouldUseDirectMicLaneFn = () => false,
  shouldDisableAppleVoiceForSessionFn = () => false,
  buildRnnoiseFallbackSuppressionRuntimeFn = () => suppressionRuntime,
  buildAppleDirectFallbackSuppressionRuntimeFn = () => ({
    backend: 'raw',
    usesBrowserProcessing: false,
    requiresWarmup: false,
    requestedBackend: requestedSuppressionRuntime?.backend || null,
    fallbackReason: null,
  }),
  getFriendlyAppleVoiceFallbackMessageFn = (message) => message,
  applyVoiceProcessingFallbackStateFn = () => {},
  applyNoiseSuppressionRoutingFn = () => false,
  appleBackend = 'apple-voice-processing',
  webrtcApmBackend = 'webrtc-apm',
  rnnoiseBackend = 'rnnoise',
} = {}) {
  let nextSuppressionRuntime = suppressionRuntime;
  let workletCreateMs = null;
  const usesAppleVoiceProcessing = nextSuppressionRuntime?.backend === appleBackend;

  if (shouldUseDirectMicLaneFn({
    useRawMicPath,
    suppressionRuntimeBackend: nextSuppressionRuntime?.backend || null,
    noiseSuppressionEnabled,
    webrtcApmBackend,
    appleBackend,
  })) {
    if (filterDiagnostics && nextSuppressionRuntime?.backend === appleBackend) {
      filterDiagnostics.backend = appleBackend;
      filterDiagnostics.requestedBackend = requestedSuppressionRuntime?.backend || appleBackend;
      filterDiagnostics.requiresWarmup = false;
      filterDiagnostics.loaded = true;
      filterDiagnostics.fallbackReason = null;
    }
    micSource.connect(gainNode);
    return {
      suppressionRuntime: nextSuppressionRuntime,
      workletCreateMs,
      backendMode: 'direct',
    };
  }

  if (usesAppleVoiceProcessing) {
    try {
      const processingResult = await startAppleProcessingLaneFn();
      workletCreateMs = processingResult.workletCreateMs;
      return {
        suppressionRuntime: nextSuppressionRuntime,
        workletCreateMs,
        backendMode: 'apple',
      };
    } catch (appleErr) {
      if (shouldDisableAppleVoiceForSessionFn(appleErr?.message)) {
        appleVoiceAvailableRef.current = false;
      }
      await cleanupAppleLaneFn({ releaseOwner: true });
      nextSuppressionRuntime = buildAppleDirectFallbackSuppressionRuntimeFn({
        requestedSuppressionRuntime,
        fallbackReason: null,
      });
      filterDiagnostics.backend = nextSuppressionRuntime.backend;
      filterDiagnostics.requestedBackend = requestedSuppressionRuntime?.backend || null;
      filterDiagnostics.requiresWarmup = nextSuppressionRuntime.requiresWarmup;
      filterDiagnostics.fallbackReason = nextSuppressionRuntime.fallbackReason;
      filterDiagnostics.loaded = true;
      micSource.connect(gainNode);
      return {
        suppressionRuntime: nextSuppressionRuntime,
        workletCreateMs,
        backendMode: 'apple-fallback-direct',
      };
    }
  }

  try {
    const processingResult = await startRnnoiseProcessingLaneFn(nextSuppressionRuntime);
    workletCreateMs = processingResult.workletCreateMs;
    return {
      suppressionRuntime: nextSuppressionRuntime,
      workletCreateMs,
      backendMode: 'rnnoise',
    };
  } catch (rnnoiseErr) {
    applyVoiceProcessingFallbackStateFn(capture, filterDiagnostics, {
      fallbackReason: rnnoiseErr?.message || 'RNNoise failed to initialize',
      noiseSuppressionEnabled,
      applyNoiseSuppressionRoutingFn,
    });
    return {
      suppressionRuntime: nextSuppressionRuntime,
      workletCreateMs,
      backendMode: 'raw',
    };
  }
}
