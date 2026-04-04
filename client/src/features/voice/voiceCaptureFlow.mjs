import {
  summarizeAudioContext,
} from '../../utils/voiceDiagnostics.js';
import {
  buildPlainVoiceCaptureConstraints,
  buildVoiceCaptureConstraints,
  getNoiseSuppressionRuntimeState,
  resolveNoiseSuppressionRuntimeState,
  getVoiceAudioContextOptions,
  isUltraLowLatencyMode,
  prefersAppleSystemVoiceIsolation,
  VOICE_PROCESSING_MODES,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
} from '../../utils/voiceProcessing.js';
import {
  acquireVoiceCaptureStream,
} from './voiceCaptureSource.mjs';
import {
  buildProcessedVoiceCaptureResult,
  buildSafeModeVoiceCaptureResult,
  buildVoiceCaptureErrorResult,
} from './voiceCaptureResult.mjs';
import {
  buildVoiceCaptureDiagnostics,
  createVoiceCaptureState,
  createVoiceFilterDiagnostics,
  ensureVoiceCaptureBypassRouting,
  setVoiceCaptureOutputTrack,
} from './voiceLiveCaptureState.mjs';
import {
  startReferenceVoiceCaptureGraph,
  startProcessedVoiceCaptureGraph,
  startSafeModeVoiceCaptureGraph,
} from './voiceCaptureGraphRuntime.mjs';
import {
  buildVoiceLiveCaptureConfig,
  resolveVoiceSuppressionRuntime,
} from './voiceLiveCaptureConfig.mjs';
import {
  startVoiceCaptureProcessingBackend,
} from './voiceCaptureBackendRuntime.mjs';
import {
  readStoredMicGain,
  readStoredVoiceInputDeviceId,
} from './voicePreferences.mjs';

export async function createVoiceLiveMicCapture({
  chId,
  mode,
  previousCapture = null,
  refs = {},
  deps = {},
} = {}) {
  const {
    liveCaptureRef = { current: null },
    appleVoiceAvailableRef = { current: false },
  } = refs;
  const {
    voiceSafeMode = false,
    voiceEmergencyDirectSourceTrack = true,
    forceFreshRawMicCapture = false,
    appleVoiceCaptureOwner = 'LIVE_VOICE',
    appleVoiceLiveStartTimeoutMs = 3200,
    rnnoiseSendMakeupGain = 1,
    updateVoiceDiagnosticsFn = () => {},
    setLiveVoiceFallbackReasonFn = () => {},
    createNoiseGateNodeFn = null,
    createRnnoiseNodeFn = null,
    createSpeexNodeFn = null,
    createKeyboardSuppressorNodeFn = null,
    createSpeechFocusChainFn = null,
    createApplePcmBridgeNodeFn = null,
    getFriendlyAppleVoiceFallbackMessageFn = null,
    normalizeElectronBinaryChunkFn = null,
    shouldDisableAppleVoiceForSessionFn = null,
    startAppleVoiceCaptureFn = null,
    stopAppleVoiceCaptureFn = null,
    isAppleVoiceCaptureSupportedFn = null,
    onAppleVoiceCaptureFrameFn = () => () => {},
    onAppleVoiceCaptureStateFn = () => () => {},
    audioContextCtor = globalThis.AudioContext,
    startVoiceCaptureProcessingBackendFn = startVoiceCaptureProcessingBackend,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    nowIsoFn = () => new Date().toISOString(),
    roundMsFn = (value) => value,
    summarizeTrackSnapshotFn = (track) => track,
    warnFn = () => {},
  } = deps;

  const {
    activeVoiceProcessingMode,
    referenceVoiceLane,
    captureConstraintMode,
    useRawMicPath,
    noiseSuppressionEnabled,
    requestedInputId,
    preferAppleVoiceProcessing,
    requestedSuppressionRuntime,
    initialConstraints,
    fallbackConstraints,
  } = buildVoiceLiveCaptureConfig({
    mode,
    referenceVoiceLane: deps.referenceVoiceLane,
    voiceSafeMode,
    appleVoiceAvailable: appleVoiceAvailableRef.current,
    readStoredVoiceInputDeviceIdFn: readStoredVoiceInputDeviceId,
    prefersAppleSystemVoiceIsolationFn: prefersAppleSystemVoiceIsolation,
    getNoiseSuppressionRuntimeStateFn: getNoiseSuppressionRuntimeState,
    buildVoiceCaptureConstraintsFn: buildVoiceCaptureConstraints,
    isUltraLowLatencyModeFn: isUltraLowLatencyMode,
    ultraLowLatencyMode: VOICE_PROCESSING_MODES.ULTRA_LOW_LATENCY,
  });
  const captureStartedAt = nowIsoFn();
  const captureStart = performanceNowFn();
  let audioGraphSetupMs = null;
  let workletCreateMs = null;
  const {
    stream,
    appliedConstraints,
    usedDefaultDeviceFallback,
    reusedExistingStream,
    getUserMediaMs,
    error: micErr,
  } = await acquireVoiceCaptureStream({
    previousCapture,
    requestedInputId,
    forceFreshRawMicCapture,
    captureConstraintMode,
    noiseSuppressionEnabled,
    initialConstraints,
    fallbackConstraints,
    buildTrackConstraintPatchFn: ({ mode: nextMode, noiseSuppressionEnabled: nextNoiseSuppressionEnabled }) => {
      if (referenceVoiceLane) {
        const plainAudioConstraints = buildPlainVoiceCaptureConstraints({
          deviceId: requestedInputId || undefined,
        }).audio;
        return typeof plainAudioConstraints === 'object' && plainAudioConstraints
          ? { ...plainAudioConstraints }
          : {};
      }

      return {
        ...buildVoiceCaptureConstraints({
          mode: nextMode,
          noiseSuppressionEnabled: nextNoiseSuppressionEnabled,
        }).audio,
      };
    },
    roundMsFn,
    onReuseFailed: (error) => {
      warnFn('[Voice] Could not reuse live mic track constraints, reacquiring:', error);
    },
    onSavedDeviceFailed: (error) => {
      warnFn('Saved mic device failed, trying default:', error);
    },
  });

  if (!stream) {
    if (micErr) {
      return buildVoiceCaptureErrorResult({
        chId,
        captureStartedAt,
        activeVoiceProcessingMode,
        appliedConstraints,
        usedDefaultDeviceFallback,
        requestedSuppressionRuntime,
        noiseSuppressionEnabled,
        useRawMicPath,
        getUserMediaMs,
        totalMs: roundMsFn(performanceNowFn() - captureStart),
        micErr,
        createVoiceFilterDiagnosticsFn: createVoiceFilterDiagnostics,
        buildVoiceCaptureDiagnosticsFn: buildVoiceCaptureDiagnostics,
      });
    }
  }

  const sourceTrack = stream.getAudioTracks()[0] || null;
  let suppressionRuntime = resolveVoiceSuppressionRuntime({
    preferAppleVoiceProcessing,
    requestedSuppressionRuntime,
    activeVoiceProcessingMode,
    noiseSuppressionEnabled,
    sourceTrack,
    resolveNoiseSuppressionRuntimeStateFn: resolveNoiseSuppressionRuntimeState,
  });

  const capture = createVoiceCaptureState({
    stream,
    requestedInputId,
    usedDefaultDeviceFallback,
    sourceTrack,
    reusedExistingStream,
  });

  const filterDiagnostics = createVoiceFilterDiagnostics({
    suppressionRuntime,
    requestedSuppressionRuntime,
    noiseSuppressionEnabled,
    useRawMicPath,
  });

  if (referenceVoiceLane) {
    suppressionRuntime = requestedSuppressionRuntime;
    const referenceGraph = await startReferenceVoiceCaptureGraph({
      capture,
      stream,
      getVoiceAudioContextOptionsFn: getVoiceAudioContextOptions,
      readStoredMicGainFn: readStoredMicGain,
      audioContextCtor,
      roundMsFn,
    });
    audioGraphSetupMs = referenceGraph.audioGraphSetupMs;

    setVoiceCaptureOutputTrack(capture, {
      sourceTrack,
      destinationTrack: referenceGraph.destinationTrack,
      // Keep the minimal reset lane on the raw microphone track for live
      // transport. The destination graph still exists for gain/VAD parity, but
      // Electron/WebRTC has been more reliable sending the original track.
      directSourceTrack: true,
    });

    return buildProcessedVoiceCaptureResult({
      capture,
      chId,
      captureStartedAt,
      activeVoiceProcessingMode,
      appliedConstraints,
      usedDefaultDeviceFallback,
      reusedExistingStream,
      sourceTrack,
      micCtx: referenceGraph.micCtx,
      filterDiagnostics: {
        ...filterDiagnostics,
        backend: 'raw',
        loaded: true,
        requiresWarmup: false,
        fallbackReason: 'Reference voice lane active',
      },
      workletCreateMs: null,
      getUserMediaMs,
      audioGraphSetupMs,
      totalMs: roundMsFn(performanceNowFn() - captureStart),
      noiseSuppressionEnabled: false,
      summarizeTrackSnapshotFn,
      summarizeAudioContextFn: summarizeAudioContext,
      buildVoiceCaptureDiagnosticsFn: buildVoiceCaptureDiagnostics,
    });
  }

  if (voiceSafeMode) {
    const safeModeGraph = await startSafeModeVoiceCaptureGraph({
      capture,
      stream,
      getVoiceAudioContextOptionsFn: getVoiceAudioContextOptions,
      readStoredMicGainFn: readStoredMicGain,
      audioContextCtor,
      roundMsFn,
      onGraphUnavailable: (error) => {
        warnFn('[Voice] Safe-mode analysis graph unavailable:', error);
      },
    });
    audioGraphSetupMs = safeModeGraph.audioGraphSetupMs ?? roundMsFn(performanceNowFn() - captureStart);

    setVoiceCaptureOutputTrack(capture, {
      sourceTrack,
      safeMode: true,
    });

    return buildSafeModeVoiceCaptureResult({
      capture,
      chId,
      captureStartedAt,
      activeVoiceProcessingMode,
      appliedConstraints,
      usedDefaultDeviceFallback,
      reusedExistingStream,
      sourceTrack,
      getUserMediaMs,
      audioGraphSetupMs,
      totalMs: roundMsFn(performanceNowFn() - captureStart),
      filterDiagnostics,
      summarizeTrackSnapshotFn,
      summarizeAudioContextFn: summarizeAudioContext,
      buildVoiceCaptureDiagnosticsFn: buildVoiceCaptureDiagnostics,
    });
  }

  const processedGraph = await startProcessedVoiceCaptureGraph({
    capture,
    stream,
    getVoiceAudioContextOptionsFn: getVoiceAudioContextOptions,
    readStoredMicGainFn: readStoredMicGain,
    audioContextCtor,
    roundMsFn,
  });
  const {
    micCtx,
    micSource,
    gainNode,
    destinationTrack,
    audioGraphSetupMs: nextAudioGraphSetupMs,
  } = processedGraph;
  audioGraphSetupMs = nextAudioGraphSetupMs;

  setVoiceCaptureOutputTrack(capture, {
    sourceTrack,
    destinationTrack,
    directSourceTrack: voiceEmergencyDirectSourceTrack && !destinationTrack,
  });
  const backendResult = await startVoiceCaptureProcessingBackendFn({
    capture,
    micCtx,
    micSource,
    gainNode,
    useRawMicPath,
    suppressionRuntime,
    activeVoiceProcessingMode,
    noiseSuppressionEnabled,
    requestedSuppressionRuntime,
    filterDiagnostics,
    refs: {
      liveCaptureRef,
      appleVoiceAvailableRef,
    },
    deps: {
      rnnoiseSendMakeupGain,
      appleVoiceCaptureOwner,
      appleVoiceLiveStartTimeoutMs,
      updateVoiceDiagnosticsFn,
      setLiveVoiceFallbackReasonFn,
      createNoiseGateNodeFn,
      createRnnoiseNodeFn,
      createSpeexNodeFn,
      createKeyboardSuppressorNodeFn,
      createSpeechFocusChainFn,
      createApplePcmBridgeNodeFn,
      getFriendlyAppleVoiceFallbackMessageFn,
      normalizeElectronBinaryChunkFn,
      shouldDisableAppleVoiceForSessionFn,
      startAppleVoiceCaptureFn,
      stopAppleVoiceCaptureFn,
      isAppleVoiceCaptureSupportedFn,
      onAppleVoiceCaptureFrameFn,
      onAppleVoiceCaptureStateFn,
      roundMsFn,
    },
  });
  suppressionRuntime = backendResult.suppressionRuntime;
  workletCreateMs = backendResult.workletCreateMs;

  if (
    backendResult.backendMode === 'direct'
    || backendResult.backendMode === 'raw'
    || backendResult.backendMode === 'apple-fallback-direct'
  ) {
    // Keep the recovery lane on the raw/direct backend, but prefer the
    // destination track when the graph has already been built so live voice
    // still benefits from the user-facing mic gain stage.
    setVoiceCaptureOutputTrack(capture, {
      sourceTrack,
      destinationTrack,
      directSourceTrack: voiceEmergencyDirectSourceTrack && !destinationTrack,
    });
  }

  return buildProcessedVoiceCaptureResult({
    capture,
    chId,
    captureStartedAt,
    activeVoiceProcessingMode,
    appliedConstraints,
    usedDefaultDeviceFallback,
    reusedExistingStream,
    sourceTrack,
    micCtx,
    filterDiagnostics,
    workletCreateMs,
    getUserMediaMs,
    audioGraphSetupMs,
    totalMs: roundMsFn(performanceNowFn() - captureStart),
    noiseSuppressionEnabled,
    summarizeTrackSnapshotFn,
    summarizeAudioContextFn: summarizeAudioContext,
    buildVoiceCaptureDiagnosticsFn: buildVoiceCaptureDiagnostics,
  });
}
