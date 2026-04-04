import { getVoiceAudioContextOptions } from '../../utils/voiceProcessing.js';
import { roundMs } from './audioSettingsModel.mjs';
import {
  buildAudioSettingsAppleIsolationDeps,
  buildAudioSettingsAppleIsolationHandlerOptions,
} from './audioSettingsControllerBindings.mjs';

function resolveWindowObject(windowObject) {
  return windowObject || globalThis.window || globalThis;
}

export function buildAudioSettingsAppleIsolationContract({
  refs = {},
  updateMicMeterFn,
  setTestDiagnosticsFn,
  setTestingFn,
  setTestStartingFn,
  attachMonitorOutputFn,
  windowObject,
  requestAnimationFrameFn,
  appleVoiceCaptureOwner = 'mic-test',
  createApplePcmBridgeNodeFn,
  getFriendlyAppleVoiceFallbackMessageFn,
  normalizeElectronBinaryChunkFn,
} = {}) {
  const resolvedWindow = resolveWindowObject(windowObject);
  const electronAPI = resolvedWindow.electronAPI;
  return buildAudioSettingsAppleIsolationHandlerOptions({
    refs,
    deps: buildAudioSettingsAppleIsolationDeps({
      createApplePcmBridgeNodeFn,
      getFriendlyAppleVoiceFallbackMessageFn,
      normalizeElectronBinaryChunkFn,
      startAppleVoiceCaptureFn: () => electronAPI.startAppleVoiceCapture(appleVoiceCaptureOwner),
      stopAppleVoiceCaptureFn: electronAPI?.stopAppleVoiceCapture,
      isAppleVoiceCaptureSupportedFn: electronAPI?.isAppleVoiceCaptureSupported,
      onAppleVoiceCaptureFrameFn: electronAPI?.onAppleVoiceCaptureFrame,
      onAppleVoiceCaptureStateFn: electronAPI?.onAppleVoiceCaptureState,
      getVoiceAudioContextOptionsFn: getVoiceAudioContextOptions,
      performanceNowFn: () => performance.now(),
      roundMsFn: roundMs,
      requestAnimationFrameFn: requestAnimationFrameFn || globalThis.requestAnimationFrame,
    }),
    updateMicMeterFn,
    setTestDiagnosticsFn,
    setTestingFn,
    setTestStartingFn,
    attachMonitorOutputFn,
  });
}
