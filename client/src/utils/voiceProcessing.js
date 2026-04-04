export const VOICE_PROCESSING_MODES = {
  STANDARD: 'standard',
  ULTRA_LOW_LATENCY: 'ultra-low-latency',
};

export const VOICE_PROCESSING_MODE_STORAGE_KEY = 'voice:processingMode';
export const VOICE_NOISE_SUPPRESSION_STORAGE_KEY = 'voice:noiseSuppression';
export const VOICE_NOISE_SUPPRESSION_STANDARD_STORAGE_KEY = 'voice:noiseSuppression:standard';
export const VOICE_NOISE_SUPPRESSION_BACKEND_STORAGE_KEY = 'voice:noiseSuppressionBackend';

export const VOICE_NOISE_SUPPRESSION_BACKENDS = {
  APPLE: 'apple-voice-processing',
  WEBRTC_APM: 'webrtc-apm',
  RNNOISE: 'rnnoise',
};

const DEFAULT_MODE = VOICE_PROCESSING_MODES.STANDARD;
const DEFAULT_NOISE_SUPPRESSION_BACKEND = VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE;

export function normalizeVoiceProcessingMode(mode) {
  return Object.values(VOICE_PROCESSING_MODES).includes(mode) ? mode : DEFAULT_MODE;
}

export function getModeForNoiseSuppressionEnabled(noiseSuppressionEnabled = true) {
  return noiseSuppressionEnabled === false
    ? VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY
    : VOICE_PROCESSING_MODES.STANDARD;
}

export function normalizeVoiceNoiseSuppressionBackend(backend) {
  return Object.values(VOICE_NOISE_SUPPRESSION_BACKENDS).includes(backend)
    ? backend
    : DEFAULT_NOISE_SUPPRESSION_BACKEND;
}

export function getStoredVoiceProcessingMode() {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_MODE;
  }
  return normalizeVoiceProcessingMode(
    localStorage.getItem(VOICE_PROCESSING_MODE_STORAGE_KEY)
  );
}

export function getStoredNoiseSuppressionBackend() {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_NOISE_SUPPRESSION_BACKEND;
  }
  const storedBackend = normalizeVoiceNoiseSuppressionBackend(
    localStorage.getItem(VOICE_NOISE_SUPPRESSION_BACKEND_STORAGE_KEY)
  );
  return storedBackend === VOICE_NOISE_SUPPRESSION_BACKENDS.WEBRTC_APM
    ? DEFAULT_NOISE_SUPPRESSION_BACKEND
    : storedBackend;
}

export function getRuntimePlatformTarget() {
  if (typeof window !== 'undefined' && window.electronAPI?.getPlatformTarget) {
    return window.electronAPI.getPlatformTarget();
  }
  if (typeof process !== 'undefined' && process.platform && process.arch) {
    return process.platform === 'darwin'
      ? `darwin-${process.arch}`
      : `${process.platform}-${process.arch}`;
  }
  return 'unknown';
}

export function prefersAppleSystemVoiceIsolation(platformTarget = getRuntimePlatformTarget()) {
  return platformTarget === 'darwin-arm64';
}

export function getPreferredNoiseSuppressionImplementation(platformTarget = getRuntimePlatformTarget()) {
  if (prefersAppleSystemVoiceIsolation(platformTarget)) {
    return {
      id: VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
      label: 'Mac Hardware Processing',
      detail: 'Uses Apple\'s native voice-processing path when your input stays on Default. macOS owns the Mic Mode choice, so Voice Isolation is selected in Control Center, not by the app.',
    };
  }

  return {
    id: VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE,
    label: 'Built-in Cleanup',
    detail: 'Uses the best available cleanup path for your device.',
  };
}

export function getAppleHardwareProcessingGuidance({
  platformTarget = getRuntimePlatformTarget(),
  selectedInput = '',
  lowLatencyEnabled = false,
} = {}) {
  if (!prefersAppleSystemVoiceIsolation(platformTarget) || lowLatencyEnabled) {
    return null;
  }

  if (selectedInput) {
    return 'Mac hardware cleanup only stays active when Input Device is set to Default. Choosing a specific mic switches /guild to its fallback cleanup path instead.';
  }

  return 'Noise Suppression is routed through Apple\'s native voice-processing path. For the strongest cleanup, choose Voice Isolation in macOS Control Center. /guild can expose Mic Modes, but macOS keeps that choice under user control.';
}

export function persistVoiceProcessingMode(mode) {
  const normalized = normalizeVoiceProcessingMode(mode);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VOICE_PROCESSING_MODE_STORAGE_KEY, normalized);
  }
  return normalized;
}

export function persistVoiceNoiseSuppressionBackend(backend) {
  const normalized = normalizeVoiceNoiseSuppressionBackend(backend);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VOICE_NOISE_SUPPRESSION_BACKEND_STORAGE_KEY, normalized);
  }
  return normalized;
}

export function isUltraLowLatencyMode(mode) {
  return normalizeVoiceProcessingMode(mode) === VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY;
}

export function getNoiseSuppressionRuntimeState({
  mode,
  noiseSuppressionEnabled = false,
  noiseSuppressionBackend,
  preferAppleVoiceProcessing = false,
} = {}) {
  if (!noiseSuppressionEnabled || isUltraLowLatencyMode(mode)) {
    return {
      backend: 'raw',
      usesBrowserProcessing: false,
      requiresWarmup: false,
    };
  }

  if (preferAppleVoiceProcessing) {
    return {
      backend: VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
      usesBrowserProcessing: false,
      requiresWarmup: true,
    };
  }

  const backend = normalizeVoiceNoiseSuppressionBackend(
    noiseSuppressionBackend || DEFAULT_NOISE_SUPPRESSION_BACKEND
  );

  return {
    backend,
    usesBrowserProcessing: backend === VOICE_NOISE_SUPPRESSION_BACKENDS.WEBRTC_APM,
    requiresWarmup: backend === VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE
      || backend === VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
  };
}

function readTrackSettingBoolean(track, key) {
  if (!track) return null;
  try {
    const settings = track.getSettings?.() || {};
    return typeof settings[key] === 'boolean' ? settings[key] : null;
  } catch {
    return null;
  }
}

export function resolveNoiseSuppressionRuntimeState({
  mode,
  noiseSuppressionEnabled = false,
  noiseSuppressionBackend,
  track,
} = {}) {
  const requested = getNoiseSuppressionRuntimeState({
    mode,
    noiseSuppressionEnabled,
    noiseSuppressionBackend,
  });

  if (
    requested.backend !== VOICE_NOISE_SUPPRESSION_BACKENDS.WEBRTC_APM
    || !noiseSuppressionEnabled
    || !track
  ) {
    return {
      ...requested,
      requestedBackend: requested.backend,
      fallbackReason: null,
    };
  }

  const trackNoiseSuppression = readTrackSettingBoolean(track, 'noiseSuppression');
  const trackAutoGainControl = readTrackSettingBoolean(track, 'autoGainControl');
  const browserProcessingActive = trackNoiseSuppression === true || trackAutoGainControl === true;

  if (browserProcessingActive) {
    return {
      ...requested,
      requestedBackend: requested.backend,
      fallbackReason: null,
    };
  }

  const fallback = getNoiseSuppressionRuntimeState({
    mode,
    noiseSuppressionEnabled,
    noiseSuppressionBackend: VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE,
  });

  return {
    ...fallback,
    requestedBackend: requested.backend,
    fallbackReason: 'This input could not use the preferred cleanup path. Using standard cleanup instead.',
  };
}

export function getStoredNoiseSuppressionEnabled() {
  if (typeof localStorage === 'undefined') {
    return true;
  }
  return localStorage.getItem(VOICE_NOISE_SUPPRESSION_STORAGE_KEY) !== 'false';
}

export function persistNoiseSuppressionEnabled(enabled, { rememberStandardPreference = true } = {}) {
  const normalized = enabled !== false;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(VOICE_NOISE_SUPPRESSION_STORAGE_KEY, String(normalized));
    if (rememberStandardPreference) {
      localStorage.setItem(VOICE_NOISE_SUPPRESSION_STANDARD_STORAGE_KEY, String(normalized));
    }
  }
  return normalized;
}

export function applyVoiceModeDependencies(mode) {
  const normalizedMode = persistVoiceProcessingMode(mode);

  if (typeof localStorage === 'undefined') {
    return {
      mode: normalizedMode,
      noiseSuppression: !isUltraLowLatencyMode(normalizedMode),
    };
  }

  if (isUltraLowLatencyMode(normalizedMode)) {
    localStorage.setItem(
      VOICE_NOISE_SUPPRESSION_STANDARD_STORAGE_KEY,
      String(getStoredNoiseSuppressionEnabled())
    );
    localStorage.setItem(VOICE_NOISE_SUPPRESSION_STORAGE_KEY, 'false');
    return {
      mode: normalizedMode,
      noiseSuppression: false,
    };
  }

  const savedStandardPreference = localStorage.getItem(VOICE_NOISE_SUPPRESSION_STANDARD_STORAGE_KEY);
  const restoredNoiseSuppression = savedStandardPreference === null ? true : savedStandardPreference !== 'false';
  localStorage.setItem(VOICE_NOISE_SUPPRESSION_STORAGE_KEY, String(restoredNoiseSuppression));
  return {
    mode: normalizedMode,
    noiseSuppression: restoredNoiseSuppression,
  };
}

export function getVoiceProcessingProfile(
  mode,
  { noiseSuppressionEnabled = false, noiseSuppressionBackend } = {},
) {
  const normalized = normalizeVoiceProcessingMode(mode);
  const suppressionRuntime = getNoiseSuppressionRuntimeState({
    mode: normalized,
    noiseSuppressionEnabled,
    noiseSuppressionBackend,
  });

  if (normalized === VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY) {
    return {
      id: normalized,
      label: 'Ultra Low Latency',
      shortLabel: 'Ultra Low',
      description: 'Headset mic recommended. Disables browser echo cancellation for the lowest delay, so built-in speakers and laptop mics can feed back.',
      browserAudio: {
        noiseSuppression: false,
        echoCancellation: false,
        autoGainControl: false,
        latency: 0,
        sampleRate: 48000,
        channelCount: 1,
      },
      suppressionRuntime,
    };
  }

  return {
    id: VOICE_PROCESSING_MODES.STANDARD,
    label: 'Standard',
    shortLabel: 'Standard',
    description: 'Best for laptop speakers. Keeps browser echo cancellation on while the optional suppression path runs through the local denoiser stack.',
    browserAudio: {
        noiseSuppression: suppressionRuntime.usesBrowserProcessing,
        echoCancellation: true,
        autoGainControl: suppressionRuntime.usesBrowserProcessing,
        latency: 0,
        sampleRate: 48000,
        channelCount: 1,
      },
      suppressionRuntime,
    };
}

export function buildVoiceCaptureConstraints({
  mode,
  deviceId,
  noiseSuppressionEnabled = false,
  noiseSuppressionBackend,
} = {}) {
  const profile = getVoiceProcessingProfile(mode, {
    noiseSuppressionEnabled,
    noiseSuppressionBackend,
  });

  return {
    audio: {
      noiseSuppression: profile.browserAudio.noiseSuppression,
      echoCancellation: profile.browserAudio.echoCancellation,
      autoGainControl: profile.browserAudio.autoGainControl,
      latency: profile.browserAudio.latency,
      sampleRate: { ideal: profile.browserAudio.sampleRate },
      channelCount: { ideal: profile.browserAudio.channelCount },
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  };
}

export function buildPlainVoiceCaptureConstraints({
  deviceId,
} = {}) {
  if (deviceId) {
    return {
      audio: {
        deviceId: { exact: deviceId },
      },
    };
  }

  return {
    audio: true,
  };
}

export function buildVoiceTrackConstraintPatch({
  mode,
  noiseSuppressionEnabled = false,
  noiseSuppressionBackend,
  echoCancellationOverride,
} = {}) {
  const profile = getVoiceProcessingProfile(mode, {
    noiseSuppressionEnabled,
    noiseSuppressionBackend,
  });

  return {
    noiseSuppression: profile.browserAudio.noiseSuppression,
    echoCancellation: echoCancellationOverride ?? profile.browserAudio.echoCancellation,
    autoGainControl: profile.browserAudio.autoGainControl,
  };
}

export function getVoiceAudioContextOptions() {
  return {
    latencyHint: 'interactive',
    sampleRate: 48000,
  };
}
