export function switchVoiceCaptureRoutingMode({
  capture = null,
  nextMode = null,
  isUltraLowLatencyModeFn = () => false,
  applyNoiseSuppressionRoutingFn = () => false,
  appleBackend = 'apple',
  rnnoiseBackend = 'rnnoise',
} = {}) {
  if (!capture) {
    return {
      handled: false,
      reason: 'no-capture',
    };
  }

  const wantsProcessedLane = !isUltraLowLatencyModeFn(nextMode);

  if (!capture.routing) {
    if (wantsProcessedLane) {
      return {
        handled: false,
        reason: 'missing-routing',
        wantsProcessedLane,
      };
    }

    return {
      handled: true,
      wantsProcessedLane,
      usingProcessedLane: false,
      activeBackend: 'raw',
      fallbackReason: null,
    };
  }

  if (wantsProcessedLane && capture.routing.processedReady !== true) {
    return {
      handled: false,
      reason: 'processed-not-ready',
      wantsProcessedLane,
    };
  }

  const usingProcessedLane = applyNoiseSuppressionRoutingFn(capture.routing, wantsProcessedLane);
  const activeBackend = usingProcessedLane
    ? (
      capture.usesAppleVoiceProcessing
        ? appleBackend
        : capture.noiseSuppressorNode
          ? rnnoiseBackend
          : 'raw'
    )
    : 'raw';
  const fallbackReason = wantsProcessedLane && !usingProcessedLane
    ? 'Noise suppression is unavailable right now.'
    : null;

  return {
    handled: true,
    wantsProcessedLane,
    usingProcessedLane,
    activeBackend,
    fallbackReason,
  };
}
