export function buildAudioSettingsBrowserGraphInput({
  refs = {},
  deps = {},
} = {}) {
  return {
    refs: {
      testRunIdRef: refs.testRunIdRef,
      audioCtxRef: refs.audioCtxRef,
      gainRef: refs.gainRef,
      noiseSuppressionRoutingRef: refs.noiseSuppressionRoutingRef,
    },
    deps: {
      stream: deps.stream,
      runId: deps.runId,
      activeVoiceMode: deps.activeVoiceMode,
      activeOutputId: deps.activeOutputId,
      monitorProfile: deps.monitorProfile,
      outputSelection: deps.outputSelection,
      requestedOutputDeviceId: deps.requestedOutputDeviceId,
      noiseSuppressionEnabled: deps.noiseSuppressionEnabled,
      useRawMicPath: deps.useRawMicPath,
      preferDirectBrowserFallback: deps.preferDirectBrowserFallback,
      requestedSuppressionRuntime: deps.requestedSuppressionRuntime,
      attachMonitorOutputFn: deps.attachMonitorOutputFn,
      addPerfPhaseFn: deps.addPerfPhaseFn,
      perfTraceId: deps.perfTraceId,
      audioContextCtor: deps.audioContextCtor,
      getVoiceAudioContextOptionsFn: deps.getVoiceAudioContextOptionsFn,
      summarizeTrackSnapshotFn: deps.summarizeTrackSnapshotFn,
      summarizeAudioContextFn: deps.summarizeAudioContextFn,
      resolveNoiseSuppressionRuntimeStateFn: deps.resolveNoiseSuppressionRuntimeStateFn,
      performanceNowFn: deps.performanceNowFn,
      roundMsFn: deps.roundMsFn,
      readStoredMicGainFn: deps.readStoredMicGainFn,
      voiceNoiseSuppressionBackends: deps.voiceNoiseSuppressionBackends,
      rnnoiseMonitorMakeupGain: deps.rnnoiseMonitorMakeupGain,
    },
  };
}
