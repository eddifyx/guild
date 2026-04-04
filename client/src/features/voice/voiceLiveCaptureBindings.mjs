import {
  createVoiceLiveMicCapture as createVoiceLiveMicCaptureInFlow,
} from './voiceCaptureFlow.mjs';
import {
  switchVoiceProcessingModeInPlace,
} from './voiceModeControlFlow.mjs';
import {
  disposeVoiceLiveCapture as disposeVoiceLiveCaptureInFlow,
  syncVoiceLiveCaptureRefs as syncVoiceLiveCaptureRefsInFlow,
} from './voiceLiveCaptureRuntime.mjs';

export function createVoiceLiveCaptureBindings({
  refs = {},
  setters = {},
  runtime = {},
  constants = {},
  deps = {},
} = {}) {
  const {
    voiceHealthProbeTimeoutRef = { current: null },
    liveCaptureRef = { current: null },
    pendingVoiceModeSwitchTraceRef = { current: null },
    localStreamRef = { current: null },
    micAudioCtxRef = { current: null },
    micGainNodeRef = { current: null },
    noiseSuppressorNodeRef = { current: null },
    residualDenoiserNodeRef = { current: null },
    noiseGateNodeRef = { current: null },
    speechFocusChainRef = { current: null },
    keyboardSuppressorNodeRef = { current: null },
    noiseSuppressionRoutingRef = { current: null },
    appleVoiceFrameCleanupRef = { current: null },
    appleVoiceStateCleanupRef = { current: null },
    appleVoiceSourceNodeRef = { current: null },
    appleVoiceAvailableRef = { current: true },
  } = refs;

  const {
    setLiveVoiceFallbackReasonFn = () => {},
  } = setters;

  const {
    clearTimeoutFn = clearTimeout,
    updateVoiceDiagnosticsFn = () => {},
    addPerfPhaseFn = () => {},
    endPerfTraceFn = () => {},
    switchVoiceCaptureRoutingModeFn = () => ({}),
    isUltraLowLatencyModeFn = () => false,
    applyNoiseSuppressionRoutingFn = () => {},
    stopAppleVoiceCaptureFn = async () => {},
    getStoredVoiceProcessingModeFn = () => 'standard',
    startAppleVoiceCaptureFn = async () => {},
    isAppleVoiceCaptureSupportedFn = async () => true,
    onAppleVoiceCaptureFrameFn = () => () => {},
    onAppleVoiceCaptureStateFn = () => () => {},
    audioContextCtor = globalThis.AudioContext,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    nowIsoFn = () => new Date().toISOString(),
    roundMsFn = (value) => value,
    summarizeTrackSnapshotFn = (value) => value,
    warnFn = () => {},
  } = runtime;

  const {
    referenceVoiceLane = false,
    voiceSafeMode = false,
    voiceEmergencyDirectSourceTrack = false,
    forceFreshRawMicCapture = false,
    appleVoiceCaptureOwner = null,
    appleVoiceLiveStartTimeoutMs = 0,
    rnnoiseSendMakeupGain = 1,
  } = constants;

  const switchVoiceProcessingModeInPlaceFn =
    deps.switchVoiceProcessingModeInPlaceFn || switchVoiceProcessingModeInPlace;
  const syncVoiceLiveCaptureRefsFn =
    deps.syncVoiceLiveCaptureRefsFn || syncVoiceLiveCaptureRefsInFlow;
  const disposeVoiceLiveCaptureFn =
    deps.disposeVoiceLiveCaptureFn || disposeVoiceLiveCaptureInFlow;
  const createVoiceLiveMicCaptureFn =
    deps.createVoiceLiveMicCaptureFn || createVoiceLiveMicCaptureInFlow;

  function clearVoiceHealthProbe() {
    if (voiceHealthProbeTimeoutRef.current) {
      clearTimeoutFn(voiceHealthProbeTimeoutRef.current);
      voiceHealthProbeTimeoutRef.current = null;
    }
  }

  function switchLiveCaptureModeInPlace(nextMode, {
    perfTraceId = null,
  } = {}) {
    return switchVoiceProcessingModeInPlaceFn({
      nextMode,
      perfTraceId,
      refs: {
        liveCaptureRef,
        pendingVoiceModeSwitchTraceRef,
      },
      updateVoiceDiagnosticsFn,
      setLiveVoiceFallbackReasonFn,
      addPerfPhaseFn,
      endPerfTraceFn,
      switchVoiceCaptureRoutingModeFn,
      isUltraLowLatencyModeFn,
      applyNoiseSuppressionRoutingFn,
    });
  }

  function syncLiveCaptureRefs(capture) {
    syncVoiceLiveCaptureRefsFn({
      liveCaptureRef,
      localStreamRef,
      micAudioCtxRef,
      micGainNodeRef,
      noiseSuppressorNodeRef,
      residualDenoiserNodeRef,
      noiseGateNodeRef,
      speechFocusChainRef,
      keyboardSuppressorNodeRef,
      noiseSuppressionRoutingRef,
      appleVoiceFrameCleanupRef,
      appleVoiceStateCleanupRef,
      appleVoiceSourceNodeRef,
    }, capture);
  }

  async function disposeLiveCapture(capture, {
    releaseOwner = true,
  } = {}) {
    return disposeVoiceLiveCaptureFn(capture, {
      releaseOwner,
      stopAppleVoiceCaptureFn,
      appleVoiceCaptureOwner,
    });
  }

  async function createLiveMicCapture({
    chId,
    mode = getStoredVoiceProcessingModeFn(),
    previousCapture = null,
  }) {
    return createVoiceLiveMicCaptureFn({
      chId,
      mode,
      previousCapture,
      refs: {
        liveCaptureRef,
        appleVoiceAvailableRef,
      },
      deps: {
        referenceVoiceLane,
        voiceSafeMode,
        voiceEmergencyDirectSourceTrack,
        forceFreshRawMicCapture,
        appleVoiceCaptureOwner,
        appleVoiceLiveStartTimeoutMs,
        rnnoiseSendMakeupGain,
        updateVoiceDiagnosticsFn,
        setLiveVoiceFallbackReasonFn,
        startAppleVoiceCaptureFn,
        stopAppleVoiceCaptureFn,
        isAppleVoiceCaptureSupportedFn,
        onAppleVoiceCaptureFrameFn,
        onAppleVoiceCaptureStateFn,
        audioContextCtor,
        performanceNowFn,
        nowIsoFn,
        roundMsFn,
        summarizeTrackSnapshotFn,
        warnFn,
      },
    });
  }

  return {
    clearVoiceHealthProbe,
    switchLiveCaptureModeInPlace,
    syncLiveCaptureRefs,
    disposeLiveCapture,
    createLiveMicCapture,
  };
}
