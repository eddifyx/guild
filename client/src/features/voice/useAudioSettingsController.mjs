import { useVoiceSettingsContext } from '../../contexts/VoiceContext';
import { useAudioSettingsControllerComposition } from './useAudioSettingsControllerComposition.mjs';
import { useAudioSettingsControllerState } from './useAudioSettingsControllerState.mjs';
import { useAudioSettingsControllerViewState } from './useAudioSettingsControllerViewState.mjs';

export function useAudioSettingsController({ onClose, openTraceId = null }) {
  const context = useVoiceSettingsContext();
  const {
    inputDevices, outputDevices,
    selectedInput, selectedOutput,
    selectInput, selectOutput,
    setOutputDevice,
    setMicGain,
    voiceProcessingMode,
    setVoiceProcessingMode,
  } = context;
  const state = useAudioSettingsControllerState({ voiceProcessingMode });
  state.selectedInputRef.current = selectedInput;
  state.selectedOutputRef.current = selectedOutput;
  state.processingModeRef.current = state.processingMode;
  state.noiseSuppressionRef.current = state.noiseSuppression;

  const viewState = useAudioSettingsControllerViewState({
    processingMode: state.processingMode,
    selectedInput,
    outputDevices,
    selectedOutput,
    testDiagnostics: state.testDiagnostics,
  });

  return useAudioSettingsControllerComposition({
    onClose,
    openTraceId,
    context: {
      inputDevices,
      outputDevices,
      selectedInput,
      selectedOutput,
      selectInput,
      selectOutput,
      setOutputDevice,
      setMicGain,
      voiceProcessingMode,
      setVoiceProcessingMode,
    },
    state,
    viewState,
  });
}
