export function syncVoiceLiveCaptureRefs(refs, capture) {
  refs.liveCaptureRef.current = capture;
  refs.localStreamRef.current = capture?.stream || null;
  refs.micAudioCtxRef.current = capture?.micCtx || null;
  refs.micGainNodeRef.current = capture?.gainNode || null;
  refs.noiseSuppressorNodeRef.current = capture?.noiseSuppressorNode || null;
  refs.residualDenoiserNodeRef.current = capture?.residualDenoiserNode || null;
  refs.noiseGateNodeRef.current = capture?.noiseGateNode || null;
  refs.speechFocusChainRef.current = capture?.speechFocusChain || null;
  refs.keyboardSuppressorNodeRef.current = capture?.keyboardSuppressorNode || null;
  refs.noiseSuppressionRoutingRef.current = capture?.routing || null;
  refs.appleVoiceFrameCleanupRef.current = capture?.appleVoiceFrameCleanup || null;
  refs.appleVoiceStateCleanupRef.current = capture?.appleVoiceStateCleanup || null;
  refs.appleVoiceSourceNodeRef.current = capture?.appleVoiceSourceNode || null;
}

export async function disposeVoiceLiveCapture(capture, {
  releaseOwner = true,
  stopAppleVoiceCaptureFn = async () => {},
  appleVoiceCaptureOwner = null,
} = {}) {
  if (!capture || capture.disposed) {
    return;
  }

  capture.disposed = true;

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
  if (capture.noiseSuppressorNode) {
    try { capture.noiseSuppressorNode.destroy?.(); } catch {}
    try { capture.noiseSuppressorNode.disconnect?.(); } catch {}
    capture.noiseSuppressorNode = null;
  }
  if (capture.residualDenoiserNode) {
    try { capture.residualDenoiserNode.destroy?.(); } catch {}
    try { capture.residualDenoiserNode.disconnect?.(); } catch {}
    capture.residualDenoiserNode = null;
  }
  if (capture.noiseGateNode) {
    try { capture.noiseGateNode.disconnect?.(); } catch {}
    capture.noiseGateNode = null;
  }
  if (capture.speechFocusChain) {
    try { capture.speechFocusChain.disconnect?.(); } catch {}
    capture.speechFocusChain = null;
  }
  if (capture.keyboardSuppressorNode) {
    try { capture.keyboardSuppressorNode.disconnect?.(); } catch {}
    capture.keyboardSuppressorNode = null;
  }
  if (capture.micCtx) {
    try { await capture.micCtx.close(); } catch {}
    capture.micCtx = null;
  }
  if (capture.stream) {
    if (capture.ownsStream !== false) {
      try { capture.stream.getTracks().forEach((track) => track.stop()); } catch {}
    }
    capture.stream = null;
  }
  if (releaseOwner && capture.usesAppleVoiceProcessing && stopAppleVoiceCaptureFn && appleVoiceCaptureOwner) {
    try {
      await stopAppleVoiceCaptureFn(appleVoiceCaptureOwner);
    } catch {}
  }
}
