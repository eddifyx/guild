import {
  VOICE_NOISE_SUPPRESSION_BACKENDS,
  VOICE_PROCESSING_MODES,
} from '../../utils/voiceProcessing.js';

export function resolveVoiceProcessingModeChange({
  mode,
  applyVoiceModeDependenciesFn = () => ({ mode, noiseSuppression: true }),
  persistVoiceProcessingModeFn = (value) => value,
  persistNoiseSuppressionEnabledFn = (value) => value,
  isUltraLowLatencyModeFn = () => false,
  standardMode = VOICE_PROCESSING_MODES.STANDARD,
} = {}) {
  if (isUltraLowLatencyModeFn(mode)) {
    return applyVoiceModeDependenciesFn(mode);
  }

  return {
    mode: persistVoiceProcessingModeFn(standardMode),
    noiseSuppression: persistNoiseSuppressionEnabledFn(true),
  };
}

export function switchVoiceProcessingModeInPlace({
  nextMode,
  perfTraceId = null,
  refs = {},
  updateVoiceDiagnosticsFn = () => {},
  setLiveVoiceFallbackReasonFn = () => {},
  addPerfPhaseFn = () => {},
  endPerfTraceFn = () => {},
  switchVoiceCaptureRoutingModeFn = () => ({ handled: false }),
  isUltraLowLatencyModeFn = () => false,
  applyNoiseSuppressionRoutingFn = () => false,
  appleBackend = VOICE_NOISE_SUPPRESSION_BACKENDS.APPLE,
  rnnoiseBackend = VOICE_NOISE_SUPPRESSION_BACKENDS.RNNOISE,
} = {}) {
  const capture = refs.liveCaptureRef?.current;
  if (!capture) {
    return false;
  }

  const routingResult = switchVoiceCaptureRoutingModeFn({
    capture,
    nextMode,
    isUltraLowLatencyModeFn,
    applyNoiseSuppressionRoutingFn,
    appleBackend,
    rnnoiseBackend,
  });

  if (!routingResult?.handled) {
    return false;
  }

  const {
    wantsProcessedLane,
    usingProcessedLane,
    activeBackend,
    fallbackReason,
  } = routingResult;

  setLiveVoiceFallbackReasonFn(fallbackReason);
  updateVoiceDiagnosticsFn((prev) => prev?.liveCapture ? {
    ...prev,
    liveCapture: {
      ...prev.liveCapture,
      mode: nextMode,
      filter: {
        ...(prev.liveCapture.filter || {}),
        backend: activeBackend,
        suppressionEnabled: wantsProcessedLane,
        loaded: wantsProcessedLane ? usingProcessedLane : true,
        fallbackReason,
      },
    },
  } : prev);

  addPerfPhaseFn(perfTraceId, 'routing-only', {
    backend: activeBackend,
    mode: nextMode,
  });
  endPerfTraceFn(perfTraceId, {
    status: 'ready',
    strategy: 'routing-only',
    backend: activeBackend,
    mode: nextMode,
    fallbackReason,
  });

  if (refs.pendingVoiceModeSwitchTraceRef?.current === perfTraceId) {
    refs.pendingVoiceModeSwitchTraceRef.current = null;
  }

  return true;
}

export function applyVoiceProcessingModeChange({
  mode,
  perfSource = 'unknown',
  uiTraceId = null,
  refs = {},
  setVoiceProcessingModeStateFn = () => {},
  setLiveVoiceFallbackReasonFn = () => {},
  startPerfTraceFn = () => null,
  cancelPerfTraceFn = () => {},
  addPerfPhaseFn = () => {},
  endPerfTraceFn = () => {},
  clearTimeoutFn = globalThis.clearTimeout,
  switchLiveCaptureModeInPlaceFn = () => false,
  applyNoiseSuppressionRoutingFn = () => {},
  scheduleLiveVoiceReconfigureFn = () => null,
  applyVoiceModeDependenciesFn = () => ({ mode, noiseSuppression: true }),
  persistVoiceProcessingModeFn = (value) => value,
  persistNoiseSuppressionEnabledFn = (value) => value,
  isUltraLowLatencyModeFn = () => false,
  standardMode = VOICE_PROCESSING_MODES.STANDARD,
} = {}) {
  const nextState = resolveVoiceProcessingModeChange({
    mode,
    applyVoiceModeDependenciesFn,
    persistVoiceProcessingModeFn,
    persistNoiseSuppressionEnabledFn,
    isUltraLowLatencyModeFn,
    standardMode,
  });
  const { mode: nextMode, noiseSuppression } = nextState;
  const currentMode = refs.voiceProcessingModeRef?.current;
  let backendPerfTraceId = null;

  if (refs.channelIdRef?.current && nextMode !== currentMode) {
    if (refs.pendingVoiceModeSwitchTraceRef?.current) {
      cancelPerfTraceFn(refs.pendingVoiceModeSwitchTraceRef.current, {
        reason: 'superseded',
      });
    }
    backendPerfTraceId = startPerfTraceFn('voice-mode-switch-backend', {
      source: perfSource,
      uiTraceId,
      channelId: refs.channelIdRef.current,
      fromMode: currentMode,
      toMode: nextMode,
    });
    refs.pendingVoiceModeSwitchTraceRef.current = backendPerfTraceId;
    addPerfPhaseFn(backendPerfTraceId, 'requested', {
      noiseSuppressionEnabled: noiseSuppression,
    });
  }

  setVoiceProcessingModeStateFn(nextMode);
  setLiveVoiceFallbackReasonFn(null);
  const wantsProcessedLane = !isUltraLowLatencyModeFn(nextMode) && noiseSuppression;

  if (refs.channelIdRef?.current) {
    if (refs.pendingLiveReconfigureRef?.current) {
      clearTimeoutFn(refs.pendingLiveReconfigureRef.current);
      refs.pendingLiveReconfigureRef.current = null;
    }
    if (!switchLiveCaptureModeInPlaceFn(nextMode, { perfTraceId: backendPerfTraceId })) {
      applyNoiseSuppressionRoutingFn(wantsProcessedLane);
      scheduleLiveVoiceReconfigureFn(backendPerfTraceId);
    }
  } else if (backendPerfTraceId) {
    endPerfTraceFn(backendPerfTraceId, {
      status: 'skipped',
      reason: 'not-in-voice',
    });
    if (refs.pendingVoiceModeSwitchTraceRef?.current === backendPerfTraceId) {
      refs.pendingVoiceModeSwitchTraceRef.current = null;
    }
  } else {
    applyNoiseSuppressionRoutingFn(wantsProcessedLane);
  }

  return nextState;
}

export function toggleVoiceNoiseSuppression({
  enabled = true,
  setVoiceProcessingModeFn = () => ({ noiseSuppression: enabled !== false }),
  standardMode = VOICE_PROCESSING_MODES.STANDARD,
  ultraLowLatencyMode = VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY,
} = {}) {
  const nextMode = enabled === false ? ultraLowLatencyMode : standardMode;
  return setVoiceProcessingModeFn(nextMode).noiseSuppression;
}
