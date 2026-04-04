import { normalizeVoiceInputDeviceId } from './voicePreferences.mjs';

export function buildVoiceLiveCaptureConfig({
  mode,
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
  const captureConstraintMode = voiceSafeMode
    ? ultraLowLatencyMode
    : activeVoiceProcessingMode;
  const useRawMicPath = isUltraLowLatencyModeFn(captureConstraintMode);
  const noiseSuppressionEnabled = voiceSafeMode ? false : !useRawMicPath;
  const inputId = normalizeVoiceInputDeviceId(readStoredVoiceInputDeviceIdFn() || '');
  const requestedInputId = inputId || '';
  const preferSystemMicMode =
    !voiceSafeMode
    && prefersAppleSystemVoiceIsolationFn()
    && appleVoiceAvailable
    && noiseSuppressionEnabled
    && !inputId;
  const preferAppleVoiceProcessing = false;
  const requestedSuppressionRuntime = getNoiseSuppressionRuntimeStateFn({
    mode: activeVoiceProcessingMode,
    noiseSuppressionEnabled,
    noiseSuppressionBackend: preferSystemMicMode ? webrtcApmBackend : undefined,
    preferAppleVoiceProcessing,
  });
  const initialConstraints = buildVoiceCaptureConstraintsFn({
    mode: captureConstraintMode,
    deviceId: inputId || undefined,
    noiseSuppressionEnabled,
  });
  const fallbackConstraints = buildVoiceCaptureConstraintsFn({
    mode: captureConstraintMode,
    noiseSuppressionEnabled,
  });

  return {
    activeVoiceProcessingMode,
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
