import {
  applyAudioSettingsNoiseSuppressionRouting,
  updateAudioSettingsMicMeter,
} from './audioSettingsControllerRuntimeUtils.mjs';
import {
  attachAudioSettingsMonitorOutput,
  clearAudioSettingsPreviewPlayback,
} from './audioSettingsMonitorRuntime.mjs';
import {
  createAudioSettingsAppleIsolationHandler,
  createAudioSettingsAttachMonitorOutputHandler,
  createAudioSettingsClearPreviewPlaybackHandler,
  createAudioSettingsCloseHandler,
  createAudioSettingsRestartTestHandler,
  createAudioSettingsStartTestHandler,
  createAudioSettingsStopTestHandler,
} from './audioSettingsMicTestRuntime.mjs';
import { restartAudioSettingsMicTest } from './audioSettingsActionFlow.mjs';
import {
  buildAudioSettingsAppleIsolationContract,
  buildAudioSettingsAttachMonitorContract,
  buildAudioSettingsMicTestStartContract,
} from './audioSettingsControllerRuntimeContracts.mjs';
import {
  buildAudioSettingsRestartTestHandlerOptions,
  buildAudioSettingsStopTestHandlerOptions,
} from './audioSettingsControllerBindings.mjs';

export function resolveAudioSettingsControllerMicTestActionDeps({
  deps = {},
} = {}) {
  return {
    updateAudioSettingsMicMeterFn:
      deps.updateAudioSettingsMicMeterFn || updateAudioSettingsMicMeter,
    applyAudioSettingsNoiseSuppressionRoutingFn:
      deps.applyAudioSettingsNoiseSuppressionRoutingFn || applyAudioSettingsNoiseSuppressionRouting,
    createAudioSettingsClearPreviewPlaybackHandlerFn:
      deps.createAudioSettingsClearPreviewPlaybackHandlerFn || createAudioSettingsClearPreviewPlaybackHandler,
    clearAudioSettingsPreviewPlaybackFn:
      deps.clearAudioSettingsPreviewPlaybackFn || clearAudioSettingsPreviewPlayback,
    createAudioSettingsAttachMonitorOutputHandlerFn:
      deps.createAudioSettingsAttachMonitorOutputHandlerFn || createAudioSettingsAttachMonitorOutputHandler,
    buildAudioSettingsAttachMonitorContractFn:
      deps.buildAudioSettingsAttachMonitorContractFn || buildAudioSettingsAttachMonitorContract,
    attachAudioSettingsMonitorOutputFn:
      deps.attachAudioSettingsMonitorOutputFn || attachAudioSettingsMonitorOutput,
    ensureVoiceAudioHostFn:
      deps.ensureVoiceAudioHostFn || (() => null),
    createAudioSettingsStopTestHandlerFn:
      deps.createAudioSettingsStopTestHandlerFn || createAudioSettingsStopTestHandler,
    buildAudioSettingsStopTestHandlerOptionsFn:
      deps.buildAudioSettingsStopTestHandlerOptionsFn || buildAudioSettingsStopTestHandlerOptions,
    createAudioSettingsAppleIsolationHandlerFn:
      deps.createAudioSettingsAppleIsolationHandlerFn || createAudioSettingsAppleIsolationHandler,
    buildAudioSettingsAppleIsolationContractFn:
      deps.buildAudioSettingsAppleIsolationContractFn || buildAudioSettingsAppleIsolationContract,
    createAudioSettingsCloseHandlerFn:
      deps.createAudioSettingsCloseHandlerFn || createAudioSettingsCloseHandler,
    createAudioSettingsStartTestHandlerFn:
      deps.createAudioSettingsStartTestHandlerFn || createAudioSettingsStartTestHandler,
    buildAudioSettingsMicTestStartContractFn:
      deps.buildAudioSettingsMicTestStartContractFn || buildAudioSettingsMicTestStartContract,
    createAudioSettingsRestartTestHandlerFn:
      deps.createAudioSettingsRestartTestHandlerFn || createAudioSettingsRestartTestHandler,
    buildAudioSettingsRestartTestHandlerOptionsFn:
      deps.buildAudioSettingsRestartTestHandlerOptionsFn || buildAudioSettingsRestartTestHandlerOptions,
    restartAudioSettingsMicTestFn:
      deps.restartAudioSettingsMicTestFn || restartAudioSettingsMicTest,
    createRnnoiseNodeFn: deps.createRnnoiseNodeFn || (() => ({})),
    createSpeexNodeFn: deps.createSpeexNodeFn || (() => ({})),
    createNoiseGateNodeFn: deps.createNoiseGateNodeFn || (() => ({})),
    createSpeechFocusChainFn: deps.createSpeechFocusChainFn || (() => ({})),
    createKeyboardSuppressorNodeFn: deps.createKeyboardSuppressorNodeFn || (() => ({})),
    shouldDisableAppleVoiceForSessionFn:
      deps.shouldDisableAppleVoiceForSessionFn || (() => false),
    getFriendlyAppleVoiceFallbackMessageFn:
      deps.getFriendlyAppleVoiceFallbackMessageFn || (() => 'Audio processing unavailable.'),
    createApplePcmBridgeNodeFn:
      deps.createApplePcmBridgeNodeFn || (() => ({})),
    normalizeElectronBinaryChunkFn:
      deps.normalizeElectronBinaryChunkFn || ((value) => value),
    appleVoiceCaptureOwner: deps.appleVoiceCaptureOwner || 'mic-test',
  };
}
