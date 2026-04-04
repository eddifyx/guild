import {
  buildVoiceCaptureConstraints,
  isUltraLowLatencyMode,
} from '../../utils/voiceProcessing.js';

export const RNNOISE_MONITOR_MAKEUP_GAIN = 2.4;
export const APPLE_VOICE_TEST_START_TIMEOUT_MS = 3200;

const HEADPHONE_OUTPUT_PATTERNS = [
  /airpods?/i,
  /head(phone|set)s?/i,
  /earbuds?/i,
  /buds/i,
  /jabra/i,
  /steelseries/i,
  /bose/i,
  /sony/i,
  /sennheiser/i,
  /plantronics/i,
  /poly/i,
];

const SPEAKER_OUTPUT_PATTERNS = [
  /speaker/i,
  /built-?in/i,
  /macbook/i,
  /imac/i,
  /studio display/i,
];

export function roundMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 10) / 10;
}

export function withTimeout(promise, timeoutMs, message, windowObject = globalThis.window) {
  return new Promise((resolve, reject) => {
    const timeoutId = windowObject.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        windowObject.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        windowObject.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function getMicLevelColor(level) {
  if (level > 60) return '#00d68f';
  if (level > 25) return '#40FF40';
  return 'var(--text-muted)';
}

export function getMicStatusText(level) {
  if (level < 5) return 'No input detected — speak to test';
  if (level < 25) return 'Low input — monitoring your mic';
  return 'Mic is working — monitoring your mic';
}

export function buildMicTestConstraints({
  mode,
  deviceId,
  noiseSuppressionEnabled = false,
} = {}) {
  const constraints = buildVoiceCaptureConstraints({ mode, deviceId, noiseSuppressionEnabled });
  if (!constraints?.audio || !isUltraLowLatencyMode(mode)) {
    return constraints;
  }

  return {
    ...constraints,
    audio: {
      ...constraints.audio,
      echoCancellation: false,
    },
  };
}

export function getActiveOutputDevice(outputDevices, selectedOutputId) {
  if (selectedOutputId) {
    const selectedDevice = outputDevices.find((device) => device.deviceId === selectedOutputId);
    if (selectedDevice) {
      return selectedDevice;
    }
  }
  return outputDevices.find((device) => device.deviceId === 'default') || outputDevices[0] || null;
}

export function resolveOutputSelection(outputDevices, selectedOutputId) {
  const activeOutput = getActiveOutputDevice(outputDevices, selectedOutputId);
  const hasExplicitSelection = Boolean(selectedOutputId);
  const matchedRequestedOutput = hasExplicitSelection
    ? outputDevices.some((device) => device.deviceId === selectedOutputId)
    : false;

  return {
    activeOutput,
    activeOutputId: activeOutput?.deviceId || '',
    hasExplicitSelection,
    usedDefaultFallback: hasExplicitSelection && !matchedRequestedOutput,
  };
}

export function getMonitorProfile(outputDevices, selectedOutputId) {
  const activeOutput = getActiveOutputDevice(outputDevices, selectedOutputId);
  const outputLabel = activeOutput?.label || '';
  const headphoneOutput = HEADPHONE_OUTPUT_PATTERNS.some((pattern) => pattern.test(outputLabel));
  const speakerOutput = SPEAKER_OUTPUT_PATTERNS.some((pattern) => pattern.test(outputLabel));

  if (headphoneOutput) {
    return {
      id: 'full',
      gain: 1,
      label: outputLabel,
      hint: 'Headphones detected. Live monitor runs at full level.',
    };
  }

  if (!speakerOutput) {
    return {
      id: 'balanced',
      gain: 0.65,
      label: outputLabel,
      hint: 'Monitor level is tuned for your selected output device.',
    };
  }

  return {
    id: 'speaker-safe',
    gain: 0.5,
    label: outputLabel,
    hint: 'Speaker-safe monitor level is on to cut down feedback. Headphones will sound cleaner.',
  };
}

export function buildAudioSettingsViewState({
  processingMode,
  outputDevices = [],
  selectedOutput = '',
  testDiagnostics = null,
} = {}) {
  const lowLatencyEnabled = isUltraLowLatencyMode(processingMode);
  const activeMonitorProfile = getMonitorProfile(outputDevices, selectedOutput);
  const noiseSuppressionFallbackReason = !lowLatencyEnabled
    ? (testDiagnostics?.filter?.fallbackReason || null)
    : null;

  return {
    lowLatencyEnabled,
    activeMonitorProfile,
    noiseSuppressionFallbackReason,
  };
}
