import {
  buildAudioSettingsStoppedDiagnosticsUpdater,
  cleanupAudioSettingsProcessingRefs,
  stopAudioSettingsStreamRef,
} from './audioSettingsTestRuntimeSupport.mjs';

export function applyAudioSettingsTestStopState({
  refs = {},
  deps = {},
} = {}) {
  const {
    noiseSuppressorNodeRef = { current: null },
    residualDenoiserNodeRef = { current: null },
    noiseGateNodeRef = { current: null },
    speechFocusChainRef = { current: null },
    keyboardSuppressorNodeRef = { current: null },
    noiseSuppressionRoutingRef = { current: null },
    monitorGainRef = { current: null },
    streamRef = { current: null },
  } = refs;

  const {
    clearPreviewPlaybackFn = () => {},
    updateMicMeterFn = () => {},
    setTestingFn = () => {},
    setTestDiagnosticsFn = () => {},
    diagnosticsUpdater = buildAudioSettingsStoppedDiagnosticsUpdater(),
  } = deps;

  cleanupAudioSettingsProcessingRefs({
    noiseSuppressorNodeRef,
    residualDenoiserNodeRef,
    noiseGateNodeRef,
    speechFocusChainRef,
    keyboardSuppressorNodeRef,
    noiseSuppressionRoutingRef,
    monitorGainRef,
  });
  clearPreviewPlaybackFn();
  stopAudioSettingsStreamRef(streamRef);
  updateMicMeterFn(0);
  setTestingFn(false);
  setTestDiagnosticsFn(diagnosticsUpdater);
}
