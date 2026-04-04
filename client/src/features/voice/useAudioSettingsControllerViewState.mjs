import {
  getAppleHardwareProcessingGuidance,
  getPreferredNoiseSuppressionImplementation,
} from '../../utils/voiceProcessing';
import { buildAudioSettingsViewState } from './audioSettingsModel.mjs';

export function useAudioSettingsControllerViewState({
  processingMode,
  selectedInput,
  outputDevices,
  selectedOutput,
  testDiagnostics,
} = {}) {
  const {
    lowLatencyEnabled,
    activeMonitorProfile,
    noiseSuppressionFallbackReason,
  } = buildAudioSettingsViewState({
    processingMode,
    outputDevices,
    selectedOutput,
    testDiagnostics,
  });
  const preferredSuppressionImplementation = getPreferredNoiseSuppressionImplementation();
  const appleHardwareProcessingGuidance = getAppleHardwareProcessingGuidance({
    selectedInput,
    lowLatencyEnabled,
  });

  return {
    lowLatencyEnabled,
    activeMonitorProfile,
    noiseSuppressionFallbackReason,
    preferredSuppressionImplementation,
    appleHardwareProcessingGuidance,
  };
}
