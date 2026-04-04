import { roundMs } from './audioSettingsModel.mjs';

export function buildAudioSettingsMonitorResult({
  mode = 'direct',
  playbackState = 'live-playing',
  playbackError = null,
  previewStart = 0,
  performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
} = {}) {
  return {
    mode,
    playbackState,
    playbackError,
    monitorSetupMs: roundMs(performanceNowFn() - previewStart),
  };
}
