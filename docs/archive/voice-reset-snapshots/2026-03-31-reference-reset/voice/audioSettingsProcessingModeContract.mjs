import {
  isUltraLowLatencyMode,
  VOICE_PROCESSING_MODES,
} from '../../utils/voiceProcessing.js';
import {
  addPerfPhase,
  endPerfTraceAfterNextPaint,
  startPerfTrace,
} from '../../utils/devPerf.js';
import {
  buildAudioSettingsProcessingModeHandlerOptions,
  buildAudioSettingsProcessingModeRuntime,
} from './audioSettingsControllerBindings.mjs';

export function buildAudioSettingsProcessingModeContract({
  testing = false,
  refs = {},
  setVoiceProcessingModeFn,
  setProcessingModeStateFn,
  setNoiseSuppressionStateFn,
  restartTestFn,
} = {}) {
  return buildAudioSettingsProcessingModeHandlerOptions({
    testing,
    refs,
    runtime: buildAudioSettingsProcessingModeRuntime({
      setVoiceProcessingModeFn,
      setProcessingModeStateFn,
      setNoiseSuppressionStateFn,
      restartTestFn,
      startPerfTraceFn: startPerfTrace,
      addPerfPhaseFn: addPerfPhase,
      endPerfTraceAfterNextPaintFn: endPerfTraceAfterNextPaint,
      isUltraLowLatencyModeFn: isUltraLowLatencyMode,
      voiceProcessingModes: VOICE_PROCESSING_MODES,
    }),
  });
}
