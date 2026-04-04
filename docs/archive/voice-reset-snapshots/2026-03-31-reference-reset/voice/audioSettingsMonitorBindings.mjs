export function buildAudioSettingsMonitorOutputOptions({
  ctx,
  gainNode,
  activeOutputId,
  monitorProfile,
  preferDirectMonitor = false,
  refs = {},
  runtime = {},
} = {}) {
  return {
    ctx,
    gainNode,
    activeOutputId,
    monitorProfile,
    preferDirectMonitor,
    refs,
    runtime,
  };
}

export function buildAudioSettingsAttachMonitorOutputHandlerOptions({
  monitorGainRef,
  previewAudioRef,
  clearPreviewPlaybackFn,
  attachAudioSettingsMonitorOutputFn,
  ensureVoiceAudioHostFn,
  performanceNowFn,
  audioCtor,
  setTimeoutFn,
  haveMetadataReadyState,
  preferPreviewMonitorOnDefault,
} = {}) {
  return {
    monitorGainRef,
    previewAudioRef,
    clearPreviewPlaybackFn,
    attachAudioSettingsMonitorOutputFn,
    ensureVoiceAudioHostFn,
    performanceNowFn,
    audioCtor,
    setTimeoutFn,
    haveMetadataReadyState,
    preferPreviewMonitorOnDefault,
  };
}

export function buildAudioSettingsAttachMonitorHandlerDeps({
  attachAudioSettingsMonitorOutputFn,
  ensureVoiceAudioHostFn,
  performanceNowFn,
  audioCtor,
  setTimeoutFn,
  haveMetadataReadyState,
  preferPreviewMonitorOnDefault,
} = {}) {
  return {
    attachAudioSettingsMonitorOutputFn,
    ensureVoiceAudioHostFn,
    performanceNowFn,
    audioCtor,
    setTimeoutFn,
    haveMetadataReadyState,
    preferPreviewMonitorOnDefault,
  };
}
