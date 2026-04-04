import { stopAudioSettingsAppleCapture } from './audioSettingsAppleCaptureStopRuntime.mjs';
import { cleanupAudioSettingsAppleRefs } from './audioSettingsAppleCleanupRefs.mjs';
import { applyAudioSettingsTestStopPrelude } from './audioSettingsTestStopPrelude.mjs';
import { applyAudioSettingsTestStopState } from './audioSettingsTestStopState.mjs';

export async function cleanupAudioSettingsAppleSetup({
  refs = {},
  deps = {},
} = {}) {
  const {
    appleVoiceFrameCleanupRef = { current: null },
    appleVoiceStateCleanupRef = { current: null },
    appleVoiceSourceNodeRef = { current: null },
    previewAudioRef = { current: null },
    audioCtxRef = { current: null },
  } = refs;

  const {
    stopAppleVoiceCaptureFn = null,
    stopAppleVoiceCaptureArgs = [],
  } = deps;

  await cleanupAudioSettingsAppleRefs({
    appleVoiceFrameCleanupRef,
    appleVoiceStateCleanupRef,
    appleVoiceSourceNodeRef,
    previewAudioRef,
    audioCtxRef,
  });

  await stopAudioSettingsAppleCapture({
    stopAppleVoiceCaptureFn,
    stopAppleVoiceCaptureArgs,
  });
}

export async function stopAudioSettingsTestRuntime({
  refs = {},
  deps = {},
} = {}) {
  const {
    testRunIdRef = { current: 0 },
    animFrameRef = { current: null },
    appleVoiceFrameCleanupRef = { current: null },
    appleVoiceStateCleanupRef = { current: null },
    appleVoiceSourceNodeRef = { current: null },
    previewAudioRef = { current: null },
    audioCtxRef = { current: null },
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
    cancelAnimationFrameFn = globalThis.cancelAnimationFrame,
    stopAppleVoiceCaptureFn = null,
    appleVoiceCaptureOwner = null,
    clearPreviewPlaybackFn = () => {},
    updateMicMeterFn = () => {},
    setTestStartingFn = () => {},
    setTestingFn = () => {},
    setTestDiagnosticsFn = () => {},
  } = deps;

  applyAudioSettingsTestStopPrelude({
    testRunIdRef,
    animFrameRef,
    cancelAnimationFrameFn,
    setTestStartingFn,
  });

  await cleanupAudioSettingsAppleSetup({
    refs: {
      appleVoiceFrameCleanupRef,
      appleVoiceStateCleanupRef,
      appleVoiceSourceNodeRef,
      previewAudioRef,
      audioCtxRef,
    },
    deps: {
      stopAppleVoiceCaptureFn,
      stopAppleVoiceCaptureArgs: appleVoiceCaptureOwner ? [appleVoiceCaptureOwner] : [],
    },
  });

  applyAudioSettingsTestStopState({
    refs: {
      noiseSuppressorNodeRef,
      residualDenoiserNodeRef,
      noiseGateNodeRef,
      speechFocusChainRef,
      keyboardSuppressorNodeRef,
      noiseSuppressionRoutingRef,
      monitorGainRef,
      streamRef,
    },
    deps: {
      clearPreviewPlaybackFn,
      updateMicMeterFn,
      setTestingFn,
      setTestDiagnosticsFn,
    },
  });
}
