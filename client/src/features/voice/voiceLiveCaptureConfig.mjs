import { normalizeVoiceInputDeviceId } from './voicePreferences.mjs';
import { buildPlainVoiceCaptureConstraints } from '../../utils/voiceProcessing.js';

export function buildVoiceLiveCaptureConfig({
  mode,
  referenceVoiceLane = false,
  voiceSafeMode = false,
  appleVoiceAvailable = false,
  readStoredVoiceInputDeviceIdFn = () => '',
  prefersAppleSystemVoiceIsolationFn = () => false,
  getNoiseSuppressionRuntimeStateFn,
  buildVoiceCaptureConstraintsFn,
  isUltraLowLatencyModeFn,
  ultraLowLatencyMode,
  webrtcApmBackend = 'webrtc-apm',
} = {}) {
  const activeVoiceProcessingMode = mode;
  const captureConstraintMode = referenceVoiceLane
    ? ultraLowLatencyMode
    : voiceSafeMode
    ? ultraLowLatencyMode
    : activeVoiceProcessingMode;
  const useRawMicPath = referenceVoiceLane || isUltraLowLatencyModeFn(captureConstraintMode);
  const noiseSuppressionEnabled = referenceVoiceLane
    ? false
    : voiceSafeMode
      ? false
      : !useRawMicPath;
  const inputId = normalizeVoiceInputDeviceId(readStoredVoiceInputDeviceIdFn() || '');
  const requestedInputId = inputId || '';
  const preferSystemMicMode =
    !referenceVoiceLane
    &&
    !voiceSafeMode
    && prefersAppleSystemVoiceIsolationFn()
    && appleVoiceAvailable
    && noiseSuppressionEnabled
    && !inputId;
  const preferAppleVoiceProcessing = false;
  const requestedSuppressionRuntime = referenceVoiceLane
    ? {
        backend: 'raw',
        requiresWarmup: false,
        fallbackReason: 'Reference voice lane active',
      }
    : getNoiseSuppressionRuntimeStateFn({
        mode: activeVoiceProcessingMode,
        noiseSuppressionEnabled,
        noiseSuppressionBackend: preferSystemMicMode ? webrtcApmBackend : undefined,
        preferAppleVoiceProcessing,
      });
  const initialConstraints = referenceVoiceLane
    ? buildPlainVoiceCaptureConstraints({
        deviceId: inputId || undefined,
      })
    : buildVoiceCaptureConstraintsFn({
        mode: captureConstraintMode,
        deviceId: inputId || undefined,
        noiseSuppressionEnabled,
      });
  const fallbackConstraints = referenceVoiceLane
    ? buildPlainVoiceCaptureConstraints()
    : buildVoiceCaptureConstraintsFn({
        mode: captureConstraintMode,
        noiseSuppressionEnabled,
      });

  return {
    activeVoiceProcessingMode,
    referenceVoiceLane,
    captureConstraintMode,
    useRawMicPath,
    noiseSuppressionEnabled,
    inputId,
    requestedInputId,
    preferSystemMicMode,
    preferAppleVoiceProcessing,
    requestedSuppressionRuntime,
    initialConstraints,
    fallbackConstraints,
  };
}

export function resolveVoiceSuppressionRuntime({
  preferAppleVoiceProcessing = false,
  requestedSuppressionRuntime = null,
  activeVoiceProcessingMode = null,
  noiseSuppressionEnabled = false,
  sourceTrack = null,
  resolveNoiseSuppressionRuntimeStateFn,
} = {}) {
  if (preferAppleVoiceProcessing) {
    return {
      ...requestedSuppressionRuntime,
      requestedBackend: requestedSuppressionRuntime?.backend || null,
      fallbackReason: null,
    };
  }

  return resolveNoiseSuppressionRuntimeStateFn({
    mode: activeVoiceProcessingMode,
    noiseSuppressionEnabled,
    track: sourceTrack,
  });
}

export function buildRnnoiseFallbackSuppressionRuntime({
  activeVoiceProcessingMode = null,
  noiseSuppressionEnabled = false,
  requestedSuppressionRuntime = null,
  fallbackReason = null,
  getNoiseSuppressionRuntimeStateFn,
  rnnoiseBackend,
} = {}) {
  return {
    ...getNoiseSuppressionRuntimeStateFn({
      mode: activeVoiceProcessingMode,
      noiseSuppressionEnabled,
      noiseSuppressionBackend: rnnoiseBackend,
    }),
    requestedBackend: requestedSuppressionRuntime?.backend || null,
    fallbackReason,
  };
}

export function buildAppleDirectFallbackSuppressionRuntime({
  requestedSuppressionRuntime = null,
  fallbackReason = null,
} = {}) {
  return {
    backend: 'raw',
    usesBrowserProcessing: false,
    requiresWarmup: false,
    requestedBackend: requestedSuppressionRuntime?.backend || null,
    fallbackReason,
  };
}

export function shouldUseDirectMicLane({
  useRawMicPath = false,
  suppressionRuntimeBackend = null,
  noiseSuppressionEnabled = false,
  webrtcApmBackend,
} = {}) {
  return (
    useRawMicPath
    || suppressionRuntimeBackend === webrtcApmBackend
    || !noiseSuppressionEnabled
  );
}
