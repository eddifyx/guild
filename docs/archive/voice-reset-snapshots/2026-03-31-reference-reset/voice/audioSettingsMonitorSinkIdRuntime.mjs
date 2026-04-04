import { fallbackAudioSettingsMonitorOutput } from './audioSettingsMonitorFallbackRuntime.mjs';

export async function applyAudioSettingsMonitorSinkId({
  previewAudio,
  activeOutputId,
  fallbackArgs = {},
} = {}) {
  if (typeof previewAudio?.setSinkId !== 'function') {
    return fallbackAudioSettingsMonitorOutput({
      ...fallbackArgs,
      mode: 'direct-fallback',
      playbackError:
        'Selected output routing is unavailable here. Monitoring through the system default output instead.',
    });
  }

  try {
    await previewAudio.setSinkId(activeOutputId);
    return null;
  } catch (sinkErr) {
    return fallbackAudioSettingsMonitorOutput({
      ...fallbackArgs,
      mode: 'direct-fallback',
      playbackError:
        sinkErr?.message ||
        'Selected output is unavailable. Monitoring through the system default output instead.',
    });
  }
}
