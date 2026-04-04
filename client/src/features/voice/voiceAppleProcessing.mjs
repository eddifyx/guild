export async function startAppleVoiceProcessingLane({
  capture = null,
  micCtx = null,
  micSource = null,
  gainNode = null,
  noiseSuppressionEnabled = true,
  filterDiagnostics = {},
  suppressionRuntimeBackend = 'apple',
  liveCaptureRef = { current: null },
  appleVoiceAvailableRef = { current: true },
  ensureVoiceCaptureBypassRoutingFn,
  createApplePcmBridgeNodeFn,
  normalizeElectronBinaryChunkFn = (chunk) => chunk,
  getFriendlyAppleVoiceFallbackMessageFn = (message) => message || 'Voice processing unavailable.',
  applyVoiceProcessingFallbackStateFn = () => {},
  applyNoiseSuppressionRoutingFn = () => false,
  setLiveVoiceFallbackReasonFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  startAppleVoiceCaptureFn = null,
  isAppleVoiceCaptureSupportedFn = null,
  onAppleVoiceCaptureFrameFn = () => () => {},
  onAppleVoiceCaptureStateFn = () => () => {},
  cleanupAppleLaneFn = async () => {},
  withTimeoutFn = async (promise) => promise,
  appleVoiceCaptureOwner = 'LIVE_VOICE',
  startTimeoutMs = 3200,
  timeoutMessage = 'macOS Voice Isolation took too long to start for live voice.',
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
} = {}) {
  if (!startAppleVoiceCaptureFn || !isAppleVoiceCaptureSupportedFn) {
    throw new Error('macOS voice processing is unavailable on this build.');
  }

  const supported = await isAppleVoiceCaptureSupportedFn().catch(() => false);
  if (!supported) {
    appleVoiceAvailableRef.current = false;
    throw new Error('macOS voice processing is unavailable on this Mac.');
  }

  const routing = ensureVoiceCaptureBypassRoutingFn(capture, {
    micCtx,
    micSource,
    gainNode,
  });
  routing.processedMakeupGain.gain.value = 1;
  routing.processedReady = false;

  const appleSourceNode = await createApplePcmBridgeNodeFn(micCtx);
  capture.appleVoiceSourceNode = appleSourceNode;
  appleSourceNode.connect(routing.processedGain);

  capture.appleVoiceFrameCleanup = onAppleVoiceCaptureFrameFn((chunk) => {
    if (capture.disposed || !capture.appleVoiceSourceNode) {
      return;
    }

    const normalizedChunk = normalizeElectronBinaryChunkFn(chunk);
    if (!normalizedChunk) {
      return;
    }

    capture.appleVoiceSourceNode.port.postMessage(
      { type: 'push', samples: normalizedChunk },
      [normalizedChunk]
    );
  });

  capture.appleVoiceStateCleanup = onAppleVoiceCaptureStateFn((payload) => {
    if (capture.disposed || !payload) {
      return;
    }

    if (payload.type === 'unavailable') {
      appleVoiceAvailableRef.current = false;
    }

    if (payload.type === 'error' || payload.type === 'ended') {
      const nextFallbackReason = getFriendlyAppleVoiceFallbackMessageFn(payload.message);
      applyVoiceProcessingFallbackStateFn(capture, filterDiagnostics, {
        fallbackReason: nextFallbackReason,
        noiseSuppressionEnabled: true,
        applyNoiseSuppressionRoutingFn,
      });
      if (liveCaptureRef.current === capture) {
        setLiveVoiceFallbackReasonFn(nextFallbackReason);
        updateVoiceDiagnosticsFn((prev) => ({
          ...prev,
          liveCapture: prev?.liveCapture ? {
            ...prev.liveCapture,
            filter: {
              ...(prev.liveCapture.filter || {}),
              backend: 'raw',
              loaded: false,
              fallbackReason: nextFallbackReason,
            },
          } : prev?.liveCapture,
        }));
      }
    }
  });

  const helperStart = nowFn();
  const helperMetadata = await withTimeoutFn(
    startAppleVoiceCaptureFn(appleVoiceCaptureOwner),
    startTimeoutMs,
    timeoutMessage
  );
  if (
    helperMetadata?.configuration
    && helperMetadata.configuration !== 'full-duplex'
    && helperMetadata.configuration !== 'capture-only'
  ) {
    throw new Error('Mac voice cleanup is unavailable in this audio configuration.');
  }
  const workletCreateMs = roundMsFn(nowFn() - helperStart);

  if (capture.disposed) {
    await cleanupAppleLaneFn({ releaseOwner: true });
    return {
      disposedBeforeReady: true,
      helperMetadata,
      routing,
      workletCreateMs,
    };
  }

  capture.usesAppleVoiceProcessing = true;
  routing.processedReady = true;
  const usingProcessedLane = applyNoiseSuppressionRoutingFn(routing, noiseSuppressionEnabled);
  filterDiagnostics.loaded = true;
  filterDiagnostics.backend = usingProcessedLane ? suppressionRuntimeBackend : 'raw';
  filterDiagnostics.fallbackReason = null;

  return {
    disposedBeforeReady: false,
    helperMetadata,
    routing,
    usingProcessedLane,
    workletCreateMs,
  };
}
