import {
  getVoiceAudioContextOptions,
  getNoiseSuppressionRuntimeState,
  isUltraLowLatencyMode,
  prefersAppleSystemVoiceIsolation,
  VOICE_PROCESSING_MODES,
  VOICE_NOISE_SUPPRESSION_BACKENDS,
  resolveNoiseSuppressionRuntimeState,
} from '../../utils/voiceProcessing.js';
import { summarizeAudioContext, summarizeTrackSnapshot } from '../../utils/voiceDiagnostics.js';
import {
  addPerfPhase,
  endPerfTrace,
  startPerfTrace,
} from '../../utils/devPerf.js';
import {
  RNNOISE_MONITOR_MAKEUP_GAIN,
  buildMicTestConstraints,
  getMonitorProfile,
  resolveOutputSelection,
  roundMs,
} from './audioSettingsModel.mjs';
import {
  buildAudioSettingsMicTestDeps,
  buildAudioSettingsMicTestStartHandlerOptions,
} from './audioSettingsControllerBindings.mjs';
import { startAudioSettingsBrowserMicTest } from './audioSettingsBrowserRuntime.mjs';

function resolveWindowObject(windowObject) {
  return windowObject || globalThis.window || globalThis;
}

export function buildAudioSettingsMicTestStartContract({
  refs = {},
  outputDevices = [],
  setTestStartingFn,
  setTestingFn,
  setTestDiagnosticsFn,
  clearPreviewPlaybackFn,
  attachMonitorOutputFn,
  updateMicMeterFn,
  applyNoiseSuppressionRoutingFn,
  startAppleVoiceIsolationTestFn,
  navigatorObject,
  windowObject,
  localStorageObject,
  AudioContextCtor,
  requestAnimationFrameFn,
  consoleObject,
  createRnnoiseNodeFn,
  createSpeexNodeFn,
  createNoiseGateNodeFn,
  createSpeechFocusChainFn,
  createKeyboardSuppressorNodeFn,
  shouldDisableAppleVoiceForSessionFn,
  getFriendlyAppleVoiceFallbackMessageFn,
} = {}) {
  const resolvedNavigator = navigatorObject || globalThis.navigator;
  const resolvedWindow = resolveWindowObject(windowObject);
  const resolvedLocalStorage = localStorageObject || globalThis.localStorage;
  const resolvedConsole = consoleObject || globalThis.console;

  return buildAudioSettingsMicTestStartHandlerOptions({
    refs,
    outputDevices,
    deps: buildAudioSettingsMicTestDeps({
      getPlatformFn: () => resolvedWindow.electronAPI?.getPlatform?.() || globalThis.process?.platform || null,
      voiceProcessingModes: VOICE_PROCESSING_MODES,
      isUltraLowLatencyModeFn: isUltraLowLatencyMode,
      resolveOutputSelectionFn: resolveOutputSelection,
      getMonitorProfileFn: getMonitorProfile,
      prefersAppleSystemVoiceIsolationFn: prefersAppleSystemVoiceIsolation,
      startPerfTraceFn: startPerfTrace,
      addPerfPhaseFn: addPerfPhase,
      getNoiseSuppressionRuntimeStateFn: getNoiseSuppressionRuntimeState,
      buildMicTestConstraintsFn: buildMicTestConstraints,
      nowIsoFn: () => new Date().toISOString(),
      performanceNowFn: () => performance.now(),
      voiceNoiseSuppressionBackends: VOICE_NOISE_SUPPRESSION_BACKENDS,
      shouldDisableAppleVoiceForSessionFn,
      getFriendlyAppleVoiceFallbackMessageFn,
      warnFn: (...args) => resolvedConsole.warn(...args),
      endPerfTraceFn: endPerfTrace,
      startAudioSettingsBrowserMicTestFn: startAudioSettingsBrowserMicTest,
      getUserMediaFn: (constraints) => resolvedNavigator.mediaDevices.getUserMedia(constraints),
      audioContextCtor: AudioContextCtor || globalThis.AudioContext,
      getVoiceAudioContextOptionsFn: getVoiceAudioContextOptions,
      summarizeTrackSnapshotFn: summarizeTrackSnapshot,
      summarizeAudioContextFn: summarizeAudioContext,
      resolveNoiseSuppressionRuntimeStateFn: resolveNoiseSuppressionRuntimeState,
      createRnnoiseNodeFn,
      createSpeexNodeFn,
      createNoiseGateNodeFn,
      createSpeechFocusChainFn,
      createKeyboardSuppressorNodeFn,
      requestAnimationFrameFn: requestAnimationFrameFn || globalThis.requestAnimationFrame,
      roundMsFn: roundMs,
      readStoredMicGainFn: () => parseFloat(resolvedLocalStorage.getItem('voice:micGain') || '3'),
      rnnoiseMonitorMakeupGain: RNNOISE_MONITOR_MAKEUP_GAIN,
      logErrorFn: (...args) => resolvedConsole.error(...args),
    }),
    setTestStartingFn,
    setTestingFn,
    setTestDiagnosticsFn,
    clearPreviewPlaybackFn,
    attachMonitorOutputFn,
    updateMicMeterFn,
    applyNoiseSuppressionRoutingFn,
    startAppleVoiceIsolationTestFn,
  });
}
