export function buildAudioSettingsControllerAppleIsolationAction({
  refs = {},
  state = {},
  deps = {},
  coreActions = {},
} = {}) {
  const {
    animFrameRef,
    gainRef,
    previewAudioRef,
    appleVoiceFrameCleanupRef,
    appleVoiceStateCleanupRef,
    appleVoiceSourceNodeRef,
    appleVoiceAvailableRef,
    testRunIdRef,
    audioCtxRef,
  } = refs;
  const {
    setTestingFn,
    setTestStartingFn,
    setTestDiagnosticsFn,
  } = state;
  const {
    updateMicMeter,
    attachMonitorOutput,
  } = coreActions;

  return deps.createAudioSettingsAppleIsolationHandlerFn(
    deps.buildAudioSettingsAppleIsolationContractFn({
      refs: {
        testRunIdRef,
        animFrameRef,
        appleVoiceFrameCleanupRef,
        appleVoiceStateCleanupRef,
        appleVoiceSourceNodeRef,
        appleVoiceAvailableRef,
        previewAudioRef,
        audioCtxRef,
        gainRef,
      },
      updateMicMeterFn: updateMicMeter,
      setTestDiagnosticsFn,
      setTestingFn,
      setTestStartingFn,
      attachMonitorOutputFn: attachMonitorOutput,
      appleVoiceCaptureOwner: deps.appleVoiceCaptureOwner,
      createApplePcmBridgeNodeFn: deps.createApplePcmBridgeNodeFn,
      getFriendlyAppleVoiceFallbackMessageFn: deps.getFriendlyAppleVoiceFallbackMessageFn,
      normalizeElectronBinaryChunkFn: deps.normalizeElectronBinaryChunkFn,
    }),
  );
}
