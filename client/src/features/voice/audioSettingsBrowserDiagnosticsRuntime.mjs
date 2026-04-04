export function buildAudioSettingsBrowserMicDiagnostics({
  updatedAt,
  startedAt,
  activeVoiceMode,
  appliedConstraints,
  usedDefaultDeviceFallback = false,
  sourceTrackSummary = null,
  audioContextSummary = null,
  filterDiagnostics = {},
  workletCreateMs = null,
  monitorPlaybackState = 'starting',
  monitorPlaybackError = null,
  outputDeviceId = null,
  outputDeviceLabel = null,
  monitorProfileId = null,
  monitorGain = null,
  requestedOutputDeviceId = null,
  usedDefaultOutputFallback = false,
  getUserMediaMs = null,
  audioGraphSetupMs = null,
  monitorSetupMs = null,
  totalMs = null,
} = {}) {
  return {
    updatedAt,
    startedAt,
    mode: activeVoiceMode,
    requestedConstraints: appliedConstraints?.audio,
    usedDefaultDeviceFallback,
    sourceTrack: sourceTrackSummary,
    audioContext: audioContextSummary,
    filter: {
      ...filterDiagnostics,
      workletCreateMs,
    },
    playback: {
      state: monitorPlaybackState,
      error: monitorPlaybackError,
      outputDeviceId,
      outputDeviceLabel,
      monitorProfile: monitorProfileId,
      monitorGain,
      requestedOutputDeviceId,
      usedDefaultOutputFallback,
    },
    timingsMs: {
      getUserMedia: getUserMediaMs,
      audioGraphSetup: audioGraphSetupMs,
      monitorSetup: monitorSetupMs,
      total: totalMs,
    },
  };
}

export function startAudioSettingsBrowserMeterLoop({
  analyser,
  animFrameRef = { current: null },
  updateMicMeterFn = () => {},
  requestAnimationFrameFn = globalThis.requestAnimationFrame,
} = {}) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
    updateMicMeterFn(Math.min(100, (avg / 128) * 100));
    animFrameRef.current = requestAnimationFrameFn(tick);
  };

  tick();
  return tick;
}
