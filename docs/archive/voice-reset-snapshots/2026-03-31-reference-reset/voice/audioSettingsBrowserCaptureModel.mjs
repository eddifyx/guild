import { buildAppleDirectFallbackSuppressionRuntime } from './voiceLiveCaptureConfig.mjs';

export function buildAudioSettingsBrowserSuppressionState({
  activeVoiceMode,
  noiseSuppressionEnabled = true,
  sourceTrack = null,
  requestedSuppressionRuntime = {},
  useRawMicPath = false,
  preferDirectBrowserFallback = false,
  resolveNoiseSuppressionRuntimeStateFn = () => ({}),
  voiceNoiseSuppressionBackends = {},
} = {}) {
  const suppressionRuntime = preferDirectBrowserFallback
    ? buildAppleDirectFallbackSuppressionRuntime({
        requestedSuppressionRuntime,
        fallbackReason: null,
      })
    : resolveNoiseSuppressionRuntimeStateFn({
        mode: activeVoiceMode,
        noiseSuppressionEnabled,
        track: sourceTrack,
      });
  const usesBrowserApm = suppressionRuntime.backend === voiceNoiseSuppressionBackends.WEBRTC_APM;
  const usesRnnoise = suppressionRuntime.backend === voiceNoiseSuppressionBackends.RNNOISE;

  return {
    suppressionRuntime,
    usesBrowserApm,
    usesRnnoise,
    filterDiagnostics: {
      backend: suppressionRuntime.backend,
      requestedBackend: requestedSuppressionRuntime.backend,
      suppressionEnabled: noiseSuppressionEnabled,
      loaded: useRawMicPath || !suppressionRuntime.requiresWarmup,
      requiresWarmup: suppressionRuntime.requiresWarmup,
      fallbackReason: suppressionRuntime.fallbackReason,
    },
  };
}

export function buildAudioSettingsBrowserGraphResult({
  ctx,
  source,
  gain,
  analyser,
  sourceTrack,
  suppressionRuntime,
  usesRnnoise = false,
  filterDiagnostics,
  audioGraphSetupMs = null,
  workletCreateMs = null,
  monitorSetupMs = null,
  monitorPlaybackState = 'starting',
  monitorPlaybackError = null,
  summarizeTrackSnapshotFn = () => null,
  summarizeAudioContextFn = () => null,
  requestedOutputDeviceId = null,
  activeOutputId = null,
  monitorProfile = {},
  outputSelection = {},
} = {}) {
  return {
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
    sourceTrackSummary: summarizeTrackSnapshotFn(sourceTrack),
    audioContextSummary: summarizeAudioContextFn(ctx),
    requestedOutputDeviceId: requestedOutputDeviceId || null,
    outputDeviceId: activeOutputId || null,
    outputDeviceLabel: monitorProfile.label || null,
    monitorProfileId: monitorProfile.id,
    monitorGain: monitorProfile.gain,
    usedDefaultOutputFallback: outputSelection.usedDefaultFallback,
  };
}
