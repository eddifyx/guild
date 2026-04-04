import {
  buildAudioSettingsAppleIsolationOptions,
  buildAudioSettingsMicTestStartOptions,
  buildAudioSettingsMonitorOutputOptions,
  buildAudioSettingsStopTestOptions,
} from './audioSettingsControllerBindings.mjs';
import {
  attachAudioSettingsMonitorOutput,
  clearAudioSettingsPreviewPlayback,
} from './audioSettingsMonitorRuntime.mjs';
import { startAudioSettingsAppleIsolationTest } from './audioSettingsAppleRuntime.mjs';
import { stopAudioSettingsTestRuntime } from './audioSettingsTestRuntime.mjs';
import {
  closeAudioSettings,
  restartAudioSettingsMicTest,
  runAudioSettingsMicTestStart,
} from './audioSettingsActionFlow.mjs';

const AUDIO_SETTINGS_APPLE_VOICE_CAPTURE_OWNER = 'mic-test';

export function createAudioSettingsClearPreviewPlaybackHandler({
  previewAudioRef,
  clearAudioSettingsPreviewPlaybackFn = clearAudioSettingsPreviewPlayback,
} = {}) {
  return function clearPreviewPlayback() {
    clearAudioSettingsPreviewPlaybackFn(previewAudioRef);
  };
}

export function createAudioSettingsAttachMonitorOutputHandler({
  monitorGainRef,
  previewAudioRef,
  clearPreviewPlaybackFn,
  attachAudioSettingsMonitorOutputFn = attachAudioSettingsMonitorOutput,
  ensureVoiceAudioHostFn = () => null,
  performanceNowFn = () => performance.now(),
  audioCtor = Audio,
  setTimeoutFn = window.setTimeout.bind(window),
  haveMetadataReadyState = HTMLMediaElement.HAVE_METADATA,
  preferPreviewMonitorOnDefault = true,
} = {}) {
  return async function attachMonitorOutput({
    ctx,
    gainNode,
    activeOutputId,
    monitorProfile,
    preferDirectMonitor = false,
  }) {
    return attachAudioSettingsMonitorOutputFn(buildAudioSettingsMonitorOutputOptions({
      ctx,
      gainNode,
      activeOutputId,
      monitorProfile,
      preferDirectMonitor,
      refs: {
        monitorGainRef,
        previewAudioRef,
      },
      runtime: {
        clearPreviewPlaybackFn,
        ensureVoiceAudioHostFn,
        performanceNowFn,
        audioCtor,
        setTimeoutFn,
        haveMetadataReadyState,
        preferPreviewMonitorOnDefault,
      },
    }));
  };
}

export function createAudioSettingsStopTestHandler({
  refs = {},
  deps = {},
  clearPreviewPlaybackFn,
  updateMicMeterFn,
  setTestStartingFn,
  setTestingFn,
  setTestDiagnosticsFn,
  stopAudioSettingsTestRuntimeFn = stopAudioSettingsTestRuntime,
  cancelAnimationFrameFn = cancelAnimationFrame,
  stopAppleVoiceCaptureFn = window.electronAPI?.stopAppleVoiceCapture,
} = {}) {
  return async function stopTest() {
    await stopAudioSettingsTestRuntimeFn(buildAudioSettingsStopTestOptions({
      refs,
      deps: {
        ...deps,
        cancelAnimationFrameFn,
        stopAppleVoiceCaptureFn,
        appleVoiceCaptureOwner: AUDIO_SETTINGS_APPLE_VOICE_CAPTURE_OWNER,
        clearPreviewPlaybackFn,
        updateMicMeterFn,
        setTestStartingFn,
        setTestingFn,
        setTestDiagnosticsFn,
      },
    }));
  };
}

export function createAudioSettingsAppleIsolationHandler({
  refs = {},
  deps = {},
  updateMicMeterFn,
  setTestDiagnosticsFn,
  setTestingFn,
  setTestStartingFn,
  attachMonitorOutputFn,
  startAudioSettingsAppleIsolationTestFn = startAudioSettingsAppleIsolationTest,
} = {}) {
  return async function startAppleVoiceIsolationTest(runtimeArgs) {
    return startAudioSettingsAppleIsolationTestFn(buildAudioSettingsAppleIsolationOptions({
      refs,
      deps: {
        ...runtimeArgs,
        ...deps,
        updateMicMeterFn,
        setTestDiagnosticsFn,
        setTestingFn,
        setTestStartingFn,
        attachMonitorOutputFn,
      },
    }));
  };
}

export function createAudioSettingsCloseHandler({
  stopTestFn,
  onCloseFn,
  closeAudioSettingsFn = closeAudioSettings,
} = {}) {
  return function handleClose() {
    void closeAudioSettingsFn({
      stopTestFn,
      onCloseFn,
    });
  };
}

export function createAudioSettingsStartTestHandler({
  refs = {},
  outputDevices = [],
  deps = {},
  setTestStartingFn,
  setTestingFn,
  setTestDiagnosticsFn,
  clearPreviewPlaybackFn,
  attachMonitorOutputFn,
  updateMicMeterFn,
  applyNoiseSuppressionRoutingFn,
  startAppleVoiceIsolationTestFn,
  runAudioSettingsMicTestStartFn = runAudioSettingsMicTestStart,
} = {}) {
  return async function startTest() {
    await runAudioSettingsMicTestStartFn(buildAudioSettingsMicTestStartOptions({
      refs,
      outputDevices,
      deps: {
        ...deps,
        setTestStartingFn,
        clearPreviewPlaybackFn,
        setTestingFn,
        setTestDiagnosticsFn,
        startAppleVoiceIsolationTestFn,
        attachMonitorOutputFn,
        updateMicMeterFn,
        applyNoiseSuppressionRoutingFn,
      },
    }));
  };
}

export function createAudioSettingsRestartTestHandler({
  testing = false,
  stopTestFn,
  startTestFn,
  restartAudioSettingsMicTestFn = restartAudioSettingsMicTest,
} = {}) {
  return function restartTest() {
    restartAudioSettingsMicTestFn({
      testing,
      stopTestFn,
      startTestFn,
    });
  };
}
