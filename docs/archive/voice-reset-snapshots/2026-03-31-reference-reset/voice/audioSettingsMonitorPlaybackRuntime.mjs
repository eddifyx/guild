import { fallbackAudioSettingsMonitorOutput } from './audioSettingsMonitorFallbackRuntime.mjs';
import { buildAudioSettingsMonitorResult } from './audioSettingsMonitorResultModel.mjs';

export async function startAudioSettingsMonitorPlayback({
  previewAudio,
  haveMetadataReadyState = globalThis.HTMLMediaElement?.HAVE_METADATA ?? 1,
  setTimeoutFn = globalThis.setTimeout,
  previewStart = 0,
  performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  fallbackArgs = {},
} = {}) {
  try {
    await new Promise((resolve) => {
      if (previewAudio.readyState >= haveMetadataReadyState) {
        resolve();
        return;
      }

      const settle = () => resolve();
      previewAudio.addEventListener('loadedmetadata', settle, { once: true });
      previewAudio.addEventListener('canplay', settle, { once: true });
      setTimeoutFn(resolve, 150);
    });

    await previewAudio.play();

    return buildAudioSettingsMonitorResult({
      mode: 'sink',
      playbackState: 'live-playing',
      playbackError: null,
      previewStart,
      performanceNowFn,
    });
  } catch (previewErr) {
    return fallbackAudioSettingsMonitorOutput({
      ...fallbackArgs,
      mode: 'sink',
      playbackState: 'live-playing',
      playbackError:
        previewErr?.message ||
        'Selected output monitor failed, so monitoring is using the system default output.',
    });
  }
}
