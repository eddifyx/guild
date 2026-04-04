import { normalizeVoiceInputDeviceId } from './voicePreferences.mjs';

export function buildAudioSettingsMicTestStartState({
  refs = {},
  outputDevices = [],
  deps = {},
} = {}) {
  const platform = deps.getPlatformFn?.() || null;
  const activeVoiceMode = refs.processingModeRef?.current || deps.voiceProcessingModes?.STANDARD;
  const useRawMicPath = deps.isUltraLowLatencyModeFn?.(activeVoiceMode) === true;
  const activeInputId = normalizeVoiceInputDeviceId(refs.selectedInputRef?.current || '');
  const outputSelection = deps.resolveOutputSelectionFn?.(
    outputDevices,
    refs.selectedOutputRef?.current
  ) || {};
  const activeOutputId = outputSelection.activeOutputId || null;
  const monitorProfile = deps.getMonitorProfileFn?.(outputDevices, activeOutputId) || {};
  const noiseSuppressionEnabled = useRawMicPath ? false : refs.noiseSuppressionRef?.current !== false;
  const preferSystemMicMode = Boolean(
    platform === 'darwin'
      && deps.prefersAppleSystemVoiceIsolationFn?.()
      && refs.appleVoiceAvailableRef?.current
      && !useRawMicPath
      && noiseSuppressionEnabled
      && !activeInputId
  );
  const allowAppleVoiceMonitorTest = false;
  const shouldUseAppleVoiceProcessing = false;
  const requestedSuppressionRuntime = deps.getNoiseSuppressionRuntimeStateFn?.({
    mode: activeVoiceMode,
    noiseSuppressionEnabled,
    noiseSuppressionBackend: preferSystemMicMode ? deps.voiceNoiseSuppressionBackends?.WEBRTC_APM : undefined,
    preferAppleVoiceProcessing: shouldUseAppleVoiceProcessing,
  }) || {};
  const initialConstraints = deps.buildMicTestConstraintsFn?.({
    mode: activeVoiceMode,
    deviceId: activeInputId,
    noiseSuppressionEnabled,
  });
  const fallbackConstraints = deps.buildMicTestConstraintsFn?.({
    mode: activeVoiceMode,
    noiseSuppressionEnabled,
  });

  return {
    activeVoiceMode,
    activeInputId,
    activeOutputId,
    fallbackConstraints,
    initialConstraints,
    monitorProfile,
    noiseSuppressionEnabled,
    outputSelection,
    requestedSuppressionRuntime,
    allowAppleVoiceMonitorTest,
    preferSystemMicMode,
    shouldUseAppleVoiceProcessing,
    useRawMicPath,
  };
}

export function buildAudioSettingsMicTestInitialDiagnostics({
  testStartedAt,
  activeVoiceMode,
  initialConstraints,
  activeOutputId,
  monitorProfile = {},
  selectedOutputDeviceId = null,
  outputSelection = {},
  shouldUseAppleVoiceProcessing = false,
  requestedSuppressionRuntime = {},
  noiseSuppressionEnabled = true,
  voiceNoiseSuppressionBackends = {},
} = {}) {
  return {
    updatedAt: testStartedAt,
    startedAt: testStartedAt,
    mode: activeVoiceMode,
    requestedConstraints: initialConstraints?.audio,
    usedDefaultDeviceFallback: false,
    filter: {
      backend: shouldUseAppleVoiceProcessing
        ? voiceNoiseSuppressionBackends.APPLE
        : requestedSuppressionRuntime.backend,
      requestedBackend: requestedSuppressionRuntime.backend,
      suppressionEnabled: noiseSuppressionEnabled,
      loaded: false,
      requiresWarmup: shouldUseAppleVoiceProcessing || requestedSuppressionRuntime.requiresWarmup,
      fallbackReason: null,
    },
    playback: {
      state: 'starting',
      error: null,
      outputDeviceId: activeOutputId || null,
      outputDeviceLabel: monitorProfile.label || null,
      monitorProfile: monitorProfile.id,
      monitorGain: monitorProfile.gain,
      requestedOutputDeviceId: selectedOutputDeviceId,
      usedDefaultOutputFallback: outputSelection.usedDefaultFallback,
    },
  };
}
