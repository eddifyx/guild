import { buildAudioSettingsMonitorResult } from './audioSettingsMonitorResultModel.mjs';

export function fallbackAudioSettingsMonitorOutput({
  clearPreviewPlaybackFn = () => {},
  monitorGain = null,
  previewDestination = null,
  destination = null,
  mode = 'direct-fallback',
  playbackState = 'live-playing',
  playbackError = null,
  previewStart = 0,
  performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  clearPreviewPlaybackFn();

  try {
    monitorGain?.disconnect?.(previewDestination);
  } catch {}

  monitorGain?.connect?.(destination);

  return buildAudioSettingsMonitorResult({
    mode,
    playbackState,
    playbackError,
    previewStart,
    performanceNowFn,
  });
}
