import { summarizeAudioContext, summarizeTrackSnapshot } from '../../utils/voiceDiagnostics.js';
import {
  getVoiceAudioContextOptions,
  resolveNoiseSuppressionRuntimeState,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
} from '../../utils/voiceProcessing.js';
import { roundMs, RNNOISE_MONITOR_MAKEUP_GAIN } from './audioSettingsModel.mjs';
import {
  buildAudioSettingsBrowserGraphResult,
  buildAudioSettingsBrowserSuppressionState,
} from './audioSettingsBrowserCaptureModel.mjs';

export async function acquireAudioSettingsBrowserMicStream({
  activeInputId = '',
  initialConstraints,
  fallbackConstraints,
  getUserMediaFn = (constraints) => globalThis.navigator.mediaDevices.getUserMedia(constraints),
  performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
  roundMsFn = roundMs,
  addPerfPhaseFn = () => {},
  perfTraceId = null,
  onUsedDefaultDeviceFallbackChangeFn = () => {},
} = {}) {
  let appliedConstraints = initialConstraints;
  let usedDefaultDeviceFallback = false;
  let getUserMediaMs = null;
  let stream = null;

  try {
    const getUserMediaStart = performanceNowFn();
    stream = await getUserMediaFn(initialConstraints);
    getUserMediaMs = roundMsFn(performanceNowFn() - getUserMediaStart);
    addPerfPhaseFn(perfTraceId, 'get-user-media-ready', {
      durationMs: getUserMediaMs,
      usedDefaultDeviceFallback: false,
    });
  } catch (selectedDeviceErr) {
    if (!activeInputId) {
      throw selectedDeviceErr;
    }
    usedDefaultDeviceFallback = true;
    onUsedDefaultDeviceFallbackChangeFn(true);
    appliedConstraints = fallbackConstraints;
    const getUserMediaStart = performanceNowFn();
    stream = await getUserMediaFn(fallbackConstraints);
    getUserMediaMs = roundMsFn(performanceNowFn() - getUserMediaStart);
    addPerfPhaseFn(perfTraceId, 'get-user-media-ready', {
      durationMs: getUserMediaMs,
      usedDefaultDeviceFallback: true,
    });
  }

  return {
    stream,
    appliedConstraints,
    usedDefaultDeviceFallback,
    getUserMediaMs,
  };
}

export async function setupAudioSettingsBrowserMicGraph({
  refs = {},
  deps = {},
} = {}) {
  const {
    testRunIdRef = { current: 0 },
    audioCtxRef = { current: null },
    gainRef = { current: null },
    noiseSuppressionRoutingRef = { current: null },
  } = refs;

  const {
    stream,
    runId,
    activeVoiceMode,
    activeOutputId = '',
    monitorProfile,
    outputSelection,
    requestedOutputDeviceId = null,
    noiseSuppressionEnabled = true,
    useRawMicPath = false,
    preferDirectBrowserFallback = false,
    requestedSuppressionRuntime,
    attachMonitorOutputFn = async () => ({
      monitorSetupMs: null,
      playbackState: 'starting',
      playbackError: null,
    }),
    addPerfPhaseFn = () => {},
    perfTraceId = null,
    audioContextCtor = globalThis.AudioContext,
    getVoiceAudioContextOptionsFn = getVoiceAudioContextOptions,
    summarizeTrackSnapshotFn = summarizeTrackSnapshot,
    summarizeAudioContextFn = summarizeAudioContext,
    resolveNoiseSuppressionRuntimeStateFn = resolveNoiseSuppressionRuntimeState,
    performanceNowFn = () => globalThis.performance?.now?.() ?? Date.now(),
    roundMsFn = roundMs,
    readStoredMicGainFn = () => parseFloat(globalThis.localStorage?.getItem?.('voice:micGain') || '3'),
    voiceNoiseSuppressionBackends = VOICE_NOISE_SUPPRESSION_BACKENDS,
    rnnoiseMonitorMakeupGain = RNNOISE_MONITOR_MAKEUP_GAIN,
  } = deps;

  const sourceTrack = stream.getAudioTracks()[0] || null;
  const {
    suppressionRuntime,
    usesBrowserApm,
    usesRnnoise,
    filterDiagnostics,
  } = buildAudioSettingsBrowserSuppressionState({
    activeVoiceMode,
    noiseSuppressionEnabled,
    sourceTrack,
    requestedSuppressionRuntime,
    useRawMicPath,
    preferDirectBrowserFallback,
    resolveNoiseSuppressionRuntimeStateFn,
    voiceNoiseSuppressionBackends,
  });

  let audioGraphSetupMs = null;
  let workletCreateMs = null;
  let monitorSetupMs = null;
  let monitorPlaybackState = 'starting';
  let monitorPlaybackError = null;

  const audioGraphStart = performanceNowFn();
  const ctx = new audioContextCtor(getVoiceAudioContextOptionsFn());
  audioCtxRef.current = ctx;
  if (ctx.state === 'suspended') {
    await ctx.resume().catch(() => {});
  }
  if (testRunIdRef.current !== runId) {
    stream.getTracks().forEach((track) => track.stop());
    ctx.close().catch(() => {});
    return null;
  }

  const source = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain();
  gain.gain.value = readStoredMicGainFn();
  gainRef.current = gain;
  audioGraphSetupMs = roundMsFn(performanceNowFn() - audioGraphStart);

  const processingOutput = ctx.createGain();
  processingOutput.gain.value = 1;
  processingOutput.connect(gain);

  if (useRawMicPath || usesBrowserApm || !noiseSuppressionEnabled) {
    source.connect(processingOutput);
  } else {
    const rawBypassGain = ctx.createGain();
    const processedGain = ctx.createGain();
    const processedMakeupGain = ctx.createGain();
    rawBypassGain.gain.value = 1;
    processedGain.gain.value = 0;
    processedMakeupGain.gain.value = rnnoiseMonitorMakeupGain;
    noiseSuppressionRoutingRef.current = {
      rawBypassGain,
      processedGain,
      processedReady: false,
    };
    source.connect(rawBypassGain);
    rawBypassGain.connect(processingOutput);
    processedGain.connect(processedMakeupGain);
    processedMakeupGain.connect(processingOutput);
  }

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  gain.connect(analyser);

  const monitorResult = await attachMonitorOutputFn({
    ctx,
    gainNode: gain,
    activeOutputId,
    monitorProfile,
    preferDirectMonitor: !outputSelection.hasExplicitSelection || outputSelection.usedDefaultFallback,
  });
  monitorSetupMs = monitorResult.monitorSetupMs;
  monitorPlaybackState = monitorResult.playbackState;
  monitorPlaybackError = monitorResult.playbackError;
  addPerfPhaseFn(perfTraceId, 'monitor-ready', {
    durationMs: monitorSetupMs,
    playbackState: monitorPlaybackState,
    playbackError: monitorPlaybackError,
  });

  if (testRunIdRef.current !== runId) {
    stream.getTracks().forEach((track) => track.stop());
    ctx.close().catch(() => {});
    return null;
  }

  return buildAudioSettingsBrowserGraphResult({
    ctx,
    source,
    gain,
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
    summarizeTrackSnapshotFn,
    summarizeAudioContextFn,
    requestedOutputDeviceId,
    activeOutputId,
    monitorProfile,
    outputSelection,
  });
}
