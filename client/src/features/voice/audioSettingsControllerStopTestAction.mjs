export function buildAudioSettingsControllerStopTestAction({
  refs = {},
  state = {},
  deps = {},
  coreActions = {},
} = {}) {
  const {
    streamRef,
    audioCtxRef,
    animFrameRef,
    monitorGainRef,
    noiseSuppressorNodeRef,
    residualDenoiserNodeRef,
    noiseGateNodeRef,
    speechFocusChainRef,
    keyboardSuppressorNodeRef,
    noiseSuppressionRoutingRef,
    previewAudioRef,
    appleVoiceFrameCleanupRef,
    appleVoiceStateCleanupRef,
    appleVoiceSourceNodeRef,
    testRunIdRef,
  } = refs;
  const {
    setTestingFn,
    setTestStartingFn,
    setTestDiagnosticsFn,
  } = state;
  const {
    updateMicMeter,
    clearPreviewPlayback,
  } = coreActions;

  return deps.createAudioSettingsStopTestHandlerFn(
    deps.buildAudioSettingsStopTestHandlerOptionsFn({
      refs: {
        testRunIdRef,
        animFrameRef,
        appleVoiceFrameCleanupRef,
        appleVoiceStateCleanupRef,
        appleVoiceSourceNodeRef,
        previewAudioRef,
        audioCtxRef,
        noiseSuppressorNodeRef,
        residualDenoiserNodeRef,
        noiseGateNodeRef,
        speechFocusChainRef,
        keyboardSuppressorNodeRef,
        noiseSuppressionRoutingRef,
        monitorGainRef,
        streamRef,
      },
      clearPreviewPlaybackFn: clearPreviewPlayback,
      updateMicMeterFn: updateMicMeter,
      setTestStartingFn,
      setTestingFn,
      setTestDiagnosticsFn,
    }),
  );
}
