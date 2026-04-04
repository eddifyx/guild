export function buildAudioSettingsAppleStateFallbackUpdater({
  payload = {},
  noiseSuppressionEnabled = true,
  getFriendlyAppleVoiceFallbackMessageFn = (message) => message || null,
} = {}) {
  return function applyAudioSettingsAppleStateFallback(prev) {
    if (!prev) {
      return prev;
    }

    return {
      ...prev,
      updatedAt: new Date().toISOString(),
      filter: {
        ...(prev.filter || {}),
        backend: 'raw',
        suppressionEnabled: noiseSuppressionEnabled,
        loaded: false,
        fallbackReason: getFriendlyAppleVoiceFallbackMessageFn(payload.message),
      },
      playback: {
        ...(prev.playback || {}),
        state: 'interrupted',
      },
    };
  };
}
