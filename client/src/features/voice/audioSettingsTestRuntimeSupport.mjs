export function cleanupAudioSettingsNodeRef(nodeRef = { current: null }, { destroy = false } = {}) {
  if (!nodeRef.current) {
    return;
  }

  if (destroy) {
    try {
      nodeRef.current.destroy?.();
    } catch {}
  }

  try {
    nodeRef.current.disconnect?.();
  } catch {}

  nodeRef.current = null;
}

export function cleanupAudioSettingsProcessingRefs({
  noiseSuppressorNodeRef = { current: null },
  residualDenoiserNodeRef = { current: null },
  noiseGateNodeRef = { current: null },
  speechFocusChainRef = { current: null },
  keyboardSuppressorNodeRef = { current: null },
  noiseSuppressionRoutingRef = { current: null },
  monitorGainRef = { current: null },
} = {}) {
  cleanupAudioSettingsNodeRef(noiseSuppressorNodeRef, { destroy: true });
  cleanupAudioSettingsNodeRef(residualDenoiserNodeRef, { destroy: true });
  cleanupAudioSettingsNodeRef(noiseGateNodeRef);
  cleanupAudioSettingsNodeRef(speechFocusChainRef);
  cleanupAudioSettingsNodeRef(keyboardSuppressorNodeRef);
  noiseSuppressionRoutingRef.current = null;
  monitorGainRef.current = null;
}

export function stopAudioSettingsStreamRef(streamRef = { current: null }) {
  if (!streamRef.current) {
    return;
  }

  streamRef.current.getTracks().forEach((track) => track.stop());
  streamRef.current = null;
}

export function buildAudioSettingsStoppedDiagnosticsUpdater({
  updatedAt = new Date().toISOString(),
} = {}) {
  return function applyAudioSettingsStoppedDiagnostics(prev) {
    if (!prev) {
      return prev;
    }

    return {
      ...prev,
      updatedAt,
      playback: {
        ...(prev.playback || {}),
        state: 'stopped',
      },
    };
  };
}
