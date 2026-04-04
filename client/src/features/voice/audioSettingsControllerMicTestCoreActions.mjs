export function buildAudioSettingsControllerMicTestCoreActions({
  refs = {},
  deps = {},
} = {}) {
  const {
    meterFillRef,
    meterValueRef,
    meterStatusRef,
    noiseSuppressionRoutingRef,
    monitorGainRef,
    previewAudioRef,
  } = refs;

  function updateMicMeter(level) {
    return deps.updateAudioSettingsMicMeterFn({
      level,
      refs: {
        meterFillRef,
        meterValueRef,
        meterStatusRef,
      },
    });
  }

  function applyNoiseSuppressionRouting(enabled) {
    return deps.applyAudioSettingsNoiseSuppressionRoutingFn({
      enabled,
      routing: noiseSuppressionRoutingRef?.current || null,
    });
  }

  const clearPreviewPlayback = deps.createAudioSettingsClearPreviewPlaybackHandlerFn({
    previewAudioRef,
    clearAudioSettingsPreviewPlaybackFn: deps.clearAudioSettingsPreviewPlaybackFn,
  });

  const attachMonitorOutput = deps.createAudioSettingsAttachMonitorOutputHandlerFn(
    deps.buildAudioSettingsAttachMonitorContractFn({
      monitorGainRef,
      previewAudioRef,
      clearPreviewPlaybackFn: clearPreviewPlayback,
      attachAudioSettingsMonitorOutputFn: deps.attachAudioSettingsMonitorOutputFn,
      ensureVoiceAudioHostFn: deps.ensureVoiceAudioHostFn,
    }),
  );

  return {
    updateMicMeter,
    applyNoiseSuppressionRouting,
    clearPreviewPlayback,
    attachMonitorOutput,
  };
}
