import { summarizeAudioContext, summarizeTrackSnapshot } from '../../utils/voiceDiagnostics.js';
import {
  getVoiceAudioContextOptions,
  isUltraLowLatencyMode,
  resolveNoiseSuppressionRuntimeState,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
} from '../../utils/voiceProcessing.js';
import { roundMs, RNNOISE_MONITOR_MAKEUP_GAIN } from './audioSettingsModel.mjs';
import {
  acquireAudioSettingsBrowserMicStream,
  setupAudioSettingsBrowserMicGraph,
} from './audioSettingsBrowserCaptureRuntime.mjs';
import {
  buildAudioSettingsBrowserMicDiagnostics,
  startAudioSettingsBrowserMeterLoop,
} from './audioSettingsBrowserDiagnosticsRuntime.mjs';
import {
  buildAudioSettingsBrowserGraphInput,
  buildAudioSettingsBrowserWarmupInput,
} from './audioSettingsBrowserRuntimeInputs.mjs';
import { warmupAudioSettingsRnnoiseTestLane } from './audioSettingsBrowserWarmupRuntime.mjs';

export async function startAudioSettingsBrowserMicTest({
  refs = {},
  deps = {},
} = {}) {
  const {
    testRunIdRef = { current: 0 },
    streamRef = { current: null },
    audioCtxRef = { current: null },
    gainRef = { current: null },
    noiseSuppressionRoutingRef = { current: null },
    animFrameRef = { current: null },
    processingModeRef = { current: null },
    noiseSuppressionRef = { current: true },
    noiseSuppressorNodeRef = { current: null },
    residualDenoiserNodeRef = { current: null },
    noiseGateNodeRef = { current: null },
    speechFocusChainRef = { current: null },
    keyboardSuppressorNodeRef = { current: null },
  } = refs;

  const {
    activeVoiceMode,
    activeInputId = '',
    activeOutputId = '',
    monitorProfile,
    outputSelection,
    requestedOutputDeviceId = null,
    noiseSuppressionEnabled = true,
    useRawMicPath = false,
    preferDirectBrowserFallback = false,
    requestedSuppressionRuntime,
    initialConstraints,
    fallbackConstraints,
    runId,
    testStart,
    testStartedAt,
    attachMonitorOutputFn = async () => ({
      monitorSetupMs: null,
      playbackState: 'starting',
      playbackError: null,
    }),
    updateMicMeterFn = () => {},
    applyNoiseSuppressionRoutingFn = () => false,
    setTestingFn = () => {},
    setTestStartingFn = () => {},
    setTestDiagnosticsFn = () => {},
    addPerfPhaseFn = () => {},
    perfTraceId = null,
    onUsedDefaultDeviceFallbackChangeFn = () => {},
    getUserMediaFn = (constraints) => globalThis.navigator.mediaDevices.getUserMedia(constraints),
    audioContextCtor = globalThis.AudioContext,
    getVoiceAudioContextOptionsFn = getVoiceAudioContextOptions,
    summarizeTrackSnapshotFn = summarizeTrackSnapshot,
    summarizeAudioContextFn = summarizeAudioContext,
    resolveNoiseSuppressionRuntimeStateFn = resolveNoiseSuppressionRuntimeState,
    createRnnoiseNodeFn = null,
    createSpeexNodeFn = null,
    createNoiseGateNodeFn = null,
    createSpeechFocusChainFn = null,
    createKeyboardSuppressorNodeFn = null,
    requestAnimationFrameFn = globalThis.requestAnimationFrame,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    roundMsFn = roundMs,
    readStoredMicGainFn = () => parseFloat(globalThis.localStorage?.getItem?.('voice:micGain') || '3'),
    voiceNoiseSuppressionBackends = VOICE_NOISE_SUPPRESSION_BACKENDS,
    rnnoiseMonitorMakeupGain = RNNOISE_MONITOR_MAKEUP_GAIN,
    warnFn = () => {},
    isUltraLowLatencyModeFn = isUltraLowLatencyMode,
  } = deps;

  const {
    stream,
    appliedConstraints,
    usedDefaultDeviceFallback,
    getUserMediaMs,
  } = await acquireAudioSettingsBrowserMicStream({
    activeInputId,
    initialConstraints,
    fallbackConstraints,
    getUserMediaFn,
    performanceNowFn,
    roundMsFn,
    addPerfPhaseFn,
    perfTraceId,
    onUsedDefaultDeviceFallbackChangeFn,
  });

  if (testRunIdRef.current !== runId) {
    stream?.getTracks?.().forEach((track) => track.stop());
    return null;
  }

  streamRef.current = stream;
  const graphState = await setupAudioSettingsBrowserMicGraph(buildAudioSettingsBrowserGraphInput({
    refs: {
      testRunIdRef,
      audioCtxRef,
      gainRef,
      noiseSuppressionRoutingRef,
    },
    deps: {
      stream,
      runId,
      activeVoiceMode,
      activeOutputId,
      monitorProfile,
      outputSelection,
      requestedOutputDeviceId,
      noiseSuppressionEnabled,
      useRawMicPath,
      preferDirectBrowserFallback,
      requestedSuppressionRuntime,
      attachMonitorOutputFn,
      addPerfPhaseFn,
      perfTraceId,
      audioContextCtor,
      getVoiceAudioContextOptionsFn,
      summarizeTrackSnapshotFn,
      summarizeAudioContextFn,
      resolveNoiseSuppressionRuntimeStateFn,
      performanceNowFn,
      roundMsFn,
      readStoredMicGainFn,
      voiceNoiseSuppressionBackends,
      rnnoiseMonitorMakeupGain,
    },
  }));

  if (!graphState) {
    return null;
  }

  const {
    ctx,
    source,
    analyser,
    sourceTrack,
    suppressionRuntime,
    usesRnnoise,
    filterDiagnostics,
    audioGraphSetupMs,
    workletCreateMs,
    monitorSetupMs,
    monitorPlaybackState,
    monitorPlaybackError,
    sourceTrackSummary,
    audioContextSummary,
    outputDeviceId,
    outputDeviceLabel,
    monitorProfileId,
    monitorGain,
    usedDefaultOutputFallback,
  } = graphState;

  setTestDiagnosticsFn(buildAudioSettingsBrowserMicDiagnostics({
    updatedAt: new Date().toISOString(),
    startedAt: testStartedAt,
    activeVoiceMode,
    appliedConstraints,
    usedDefaultDeviceFallback,
    sourceTrackSummary,
    audioContextSummary,
    filterDiagnostics,
    workletCreateMs,
    monitorPlaybackState,
    monitorPlaybackError,
    outputDeviceId,
    outputDeviceLabel,
    monitorProfileId,
    monitorGain,
    requestedOutputDeviceId,
    usedDefaultOutputFallback,
    getUserMediaMs,
    audioGraphSetupMs,
    monitorSetupMs,
    totalMs: roundMsFn(performanceNowFn() - testStart),
  }));

  startAudioSettingsBrowserMeterLoop({
    analyser,
    animFrameRef,
    updateMicMeterFn,
    requestAnimationFrameFn,
  });
  setTestingFn(true);
  setTestStartingFn(false);

  if (!useRawMicPath && usesRnnoise) {
    void warmupAudioSettingsRnnoiseTestLane(buildAudioSettingsBrowserWarmupInput({
      refs: {
        testRunIdRef,
        audioCtxRef,
        processingModeRef,
        noiseSuppressionRef,
        noiseSuppressorNodeRef,
        residualDenoiserNodeRef,
        noiseGateNodeRef,
        speechFocusChainRef,
        keyboardSuppressorNodeRef,
        noiseSuppressionRoutingRef,
      },
      deps: {
        ctx,
        source,
        runId,
        suppressionRuntime,
        createRnnoiseNodeFn,
        createSpeexNodeFn,
        createNoiseGateNodeFn,
        createSpeechFocusChainFn,
        createKeyboardSuppressorNodeFn,
        applyNoiseSuppressionRoutingFn,
        setTestDiagnosticsFn,
        addPerfPhaseFn,
        perfTraceId,
        roundMsFn,
        warnFn,
        isUltraLowLatencyModeFn,
      },
    }));
  }

  return {
    suppressionRuntime,
    usedDefaultDeviceFallback,
    playbackState: monitorPlaybackState,
  };
}
