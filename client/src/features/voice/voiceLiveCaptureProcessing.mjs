export async function cleanupAppleVoiceProcessingLane(capture, {
  releaseOwner = false,
  stopAppleVoiceCaptureFn = async () => {},
  appleVoiceCaptureOwner = null,
} = {}) {
  if (!capture) return;

  if (capture.appleVoiceFrameCleanup) {
    try { capture.appleVoiceFrameCleanup(); } catch {}
    capture.appleVoiceFrameCleanup = null;
  }
  if (capture.appleVoiceStateCleanup) {
    try { capture.appleVoiceStateCleanup(); } catch {}
    capture.appleVoiceStateCleanup = null;
  }
  if (capture.appleVoiceSourceNode) {
    try { capture.appleVoiceSourceNode.port.postMessage({ type: 'reset' }); } catch {}
    try { capture.appleVoiceSourceNode.disconnect?.(); } catch {}
    capture.appleVoiceSourceNode = null;
  }
  capture.usesAppleVoiceProcessing = false;

  if (releaseOwner && stopAppleVoiceCaptureFn && appleVoiceCaptureOwner) {
    try {
      await stopAppleVoiceCaptureFn(appleVoiceCaptureOwner);
    } catch {}
  }
}

function shouldBypassKeyboardSuppressorError(error, audioContext) {
  const message = String(error?.message || error || '').toLowerCase();
  if (!message || audioContext?.state === 'closed') {
    return false;
  }

  return message.includes('audioworkletnode cannot be created')
    || message.includes('no execution context available');
}

export function applyVoiceProcessingFallbackState(capture, filterDiagnostics, {
  fallbackReason = null,
  noiseSuppressionEnabled = false,
  applyNoiseSuppressionRoutingFn = () => false,
} = {}) {
  filterDiagnostics.backend = 'raw';
  filterDiagnostics.loaded = false;
  filterDiagnostics.fallbackReason = fallbackReason;
  if (capture?.routing) {
    capture.routing.processedReady = false;
    applyNoiseSuppressionRoutingFn(capture.routing, noiseSuppressionEnabled);
  }
}

export async function startRnnoiseVoiceProcessingLane({
  capture,
  micCtx,
  micSource,
  routing,
  noiseSuppressionEnabled = false,
  suppressionRuntimeBackend = 'rnnoise',
  filterDiagnostics,
  applyNoiseSuppressionRoutingFn = () => false,
  createRnnoiseNodeFn,
  createSpeexNodeFn,
  createNoiseGateNodeFn,
  createSpeechFocusChainFn,
  createKeyboardSuppressorNodeFn,
  rnnoiseSendMakeupGain = 1,
  nowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = (value) => value,
} = {}) {
  routing.processedMakeupGain.gain.value = rnnoiseSendMakeupGain;
  routing.processedReady = false;

  const workletStart = nowFn();
  const rnnoiseNode = await createRnnoiseNodeFn(micCtx, { maxChannels: 1 });
  const workletCreateMs = roundMsFn(nowFn() - workletStart);
  if (capture.disposed) {
    rnnoiseNode.destroy?.();
    return { workletCreateMs, started: false };
  }

  const speexNode = await createSpeexNodeFn(micCtx, { maxChannels: 1 });
  const noiseGateNode = await createNoiseGateNodeFn(micCtx, { maxChannels: 1 });
  const speechFocusChain = createSpeechFocusChainFn(micCtx);
  let keyboardSuppressorNode = null;
  try {
    keyboardSuppressorNode = await createKeyboardSuppressorNodeFn(micCtx, { maxChannels: 1 });
  } catch (keyboardErr) {
    if (!shouldBypassKeyboardSuppressorError(keyboardErr, micCtx)) {
      throw keyboardErr;
    }
  }
  if (capture.disposed) {
    keyboardSuppressorNode?.disconnect?.();
    speechFocusChain.disconnect?.();
    speexNode.destroy?.();
    noiseGateNode.disconnect?.();
    rnnoiseNode.destroy?.();
    return { workletCreateMs, started: false };
  }

  capture.noiseSuppressorNode = rnnoiseNode;
  capture.residualDenoiserNode = speexNode;
  capture.noiseGateNode = noiseGateNode;
  capture.speechFocusChain = speechFocusChain;
  capture.keyboardSuppressorNode = keyboardSuppressorNode;
  routing.processedReady = true;
  micSource.connect(rnnoiseNode);
  rnnoiseNode.connect(speexNode);
  speexNode.connect(noiseGateNode);
  noiseGateNode.connect(speechFocusChain.input);
  if (keyboardSuppressorNode) {
    speechFocusChain.output.connect(keyboardSuppressorNode);
    keyboardSuppressorNode.connect(routing.processedGain);
  } else {
    speechFocusChain.output.connect(routing.processedGain);
  }
  const usingProcessedLane = applyNoiseSuppressionRoutingFn(routing, noiseSuppressionEnabled);
  filterDiagnostics.loaded = true;
  filterDiagnostics.backend = usingProcessedLane ? suppressionRuntimeBackend : 'raw';
  filterDiagnostics.fallbackReason = null;

  return {
    workletCreateMs,
    started: true,
  };
}
