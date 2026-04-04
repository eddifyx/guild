export function applyAudioSettingsOutputChange({
  deviceId = '',
  refs = {},
  outputDevices = [],
  selectOutputFn = () => {},
  setOutputDeviceFn = () => {},
  restartTestFn = () => {},
  resolveOutputSelectionFn = () => ({
    activeOutputId: null,
    hasExplicitSelection: false,
    usedDefaultFallback: false,
  }),
  getMonitorProfileFn = () => ({
    id: null,
    label: null,
    gain: 1,
  }),
  setTestDiagnosticsFn = () => {},
} = {}) {
  const outputSelection = resolveOutputSelectionFn(outputDevices, deviceId);
  const monitorProfile = getMonitorProfileFn(outputDevices, deviceId);

  if (refs.skipSelectedOutputSyncRestartRef) {
    refs.skipSelectedOutputSyncRestartRef.current = true;
  }
  if (refs.selectedOutputRef) {
    refs.selectedOutputRef.current = deviceId;
  }

  selectOutputFn(deviceId);
  setOutputDeviceFn(deviceId);
  restartTestFn();

  const previewAudio = refs.previewAudioRef?.current;
  if (
    previewAudio?.setSinkId
    && outputSelection.hasExplicitSelection
    && !outputSelection.usedDefaultFallback
    && outputSelection.activeOutputId
  ) {
    previewAudio.setSinkId(outputSelection.activeOutputId).catch(() => {});
  }

  if (refs.monitorGainRef?.current) {
    refs.monitorGainRef.current.gain.value = monitorProfile.gain;
  }

  setTestDiagnosticsFn((prev) => prev ? {
    ...prev,
    playback: {
      ...(prev.playback || {}),
      outputDeviceId: outputSelection.activeOutputId || null,
      outputDeviceLabel: monitorProfile.label || null,
      monitorProfile: monitorProfile.id,
      monitorGain: monitorProfile.gain,
      requestedOutputDeviceId: deviceId || null,
      usedDefaultOutputFallback: outputSelection.usedDefaultFallback,
    },
  } : prev);

  return {
    outputSelection,
    monitorProfile,
  };
}

export function restartAudioSettingsMicTest({
  testing = false,
  stopTestFn = async () => {},
  startTestFn = async () => {},
} = {}) {
  if (!testing) return false;
  void stopTestFn().then(() => {
    startTestFn();
  });
  return true;
}

export async function closeAudioSettings({
  stopTestFn = async () => {},
  onCloseFn = () => {},
} = {}) {
  await stopTestFn();
  onCloseFn();
}

export function applyAudioSettingsProcessingModeChange({
  nextMode = null,
  testing = false,
  refs = {},
  setVoiceProcessingModeFn = null,
  setProcessingModeStateFn = () => {},
  setNoiseSuppressionStateFn = () => {},
  restartTestFn = () => {},
  startPerfTraceFn = () => null,
  addPerfPhaseFn = () => {},
  endPerfTraceAfterNextPaintFn = () => {},
  isUltraLowLatencyModeFn = () => false,
  voiceProcessingModes = {},
} = {}) {
  if (!nextMode || nextMode === refs.processingModeRef?.current) {
    return false;
  }

  const uiTraceId = startPerfTraceFn('voice-mode-switch-ui', {
    surface: 'audio-settings',
    fromMode: refs.processingModeRef?.current,
    toMode: nextMode,
    testing,
  });
  addPerfPhaseFn(uiTraceId, 'click');

  const nextState = setVoiceProcessingModeFn
    ? setVoiceProcessingModeFn(nextMode, {
      perfSource: 'audio-settings',
      uiTraceId,
    })
    : {
      mode: nextMode,
      noiseSuppression: nextMode !== voiceProcessingModes.ULTRA_LOW_LATENCY,
    };

  const noiseSuppression = nextState?.noiseSuppression ?? !isUltraLowLatencyModeFn(nextState?.mode);

  if (refs.processingModeRef) {
    refs.processingModeRef.current = nextState.mode;
  }
  if (refs.noiseSuppressionRef) {
    refs.noiseSuppressionRef.current = noiseSuppression;
  }

  setProcessingModeStateFn(nextState.mode);
  setNoiseSuppressionStateFn(noiseSuppression);
  restartTestFn();
  endPerfTraceAfterNextPaintFn(uiTraceId, {
    status: 'ready',
    surface: 'audio-settings',
    testing,
  });
  return nextState;
}
