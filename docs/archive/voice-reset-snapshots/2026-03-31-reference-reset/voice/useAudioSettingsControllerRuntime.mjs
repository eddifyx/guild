import { useMemo } from 'react';
import { createNoiseGateNode, createRnnoiseNode, createSpeexNode } from '../../utils/rnnoise.js';
import { createKeyboardSuppressorNode } from '../../utils/keyboardSuppressor.js';
import { createSpeechFocusChain } from '../../utils/voiceToneShaping.js';
import {
  APPLE_VOICE_CAPTURE_OWNERS,
  createApplePcmBridgeNode,
  getFriendlyAppleVoiceFallbackMessage,
  normalizeElectronBinaryChunk,
  shouldDisableAppleVoiceForSession,
} from '../../utils/appleVoiceCapture.js';
import { ensureVoiceAudioHost } from './voiceRuntimeUtils.mjs';
import { useAudioSettingsRuntimeEffects } from './useAudioSettingsRuntimeEffects.mjs';
import {
  buildAudioSettingsRuntimeEffectsContract,
} from './audioSettingsControllerRuntimeContracts.mjs';
import { createAudioSettingsControllerActions } from './audioSettingsControllerActions.mjs';

export function useAudioSettingsControllerRuntime({
  onClose,
  openTraceId = null,
  outputDevices = [],
  selectedInput,
  selectedOutput,
  processingMode,
  noiseSuppression,
  voiceProcessingMode,
  testing,
  refs = {},
  state = {},
  actions = {},
} = {}) {
  const {
    appleVoiceAvailableRef,
    completedOpenTraceIdsRef,
    selectedInputRef,
    selectedOutputRef,
    processingModeRef,
    noiseSuppressionRef,
    skipSelectedOutputSyncRestartRef,
  } = refs;
  const {
    setNoiseSuppressionStateFn,
    setProcessingModeStateFn,
  } = state;

  const {
    updateMicMeter,
    stopTest,
    restartTest,
    handleClose,
    startTest,
    handleOutputChange,
    handleInputChange,
    handleSelectProcessingMode,
  } = useMemo(() => createAudioSettingsControllerActions({
    onClose,
    outputDevices,
    testing,
    refs,
    state,
    actions,
    deps: {
      createRnnoiseNodeFn: createRnnoiseNode,
      createSpeexNodeFn: createSpeexNode,
      createNoiseGateNodeFn: createNoiseGateNode,
      createSpeechFocusChainFn: createSpeechFocusChain,
      createKeyboardSuppressorNodeFn: createKeyboardSuppressorNode,
      ensureVoiceAudioHostFn: ensureVoiceAudioHost,
      shouldDisableAppleVoiceForSessionFn: shouldDisableAppleVoiceForSession,
      getFriendlyAppleVoiceFallbackMessageFn: getFriendlyAppleVoiceFallbackMessage,
      createApplePcmBridgeNodeFn: createApplePcmBridgeNode,
      normalizeElectronBinaryChunkFn: normalizeElectronBinaryChunk,
      appleVoiceCaptureOwner: APPLE_VOICE_CAPTURE_OWNERS.MIC_TEST,
    },
  }), [actions, onClose, outputDevices, refs, state, testing]);

  useAudioSettingsRuntimeEffects(buildAudioSettingsRuntimeEffectsContract({
    selectedInput,
    selectedOutput,
    processingMode,
    noiseSuppression,
    voiceProcessingMode,
    testing,
    openTraceId,
    outputDevices,
    refs: {
      selectedInputRef,
      selectedOutputRef,
      processingModeRef,
      noiseSuppressionRef,
      appleVoiceAvailableRef,
      skipSelectedOutputSyncRestartRef,
      completedOpenTraceIdsRef,
    },
    state: {
      setProcessingModeStateFn,
      setNoiseSuppressionStateFn,
    },
    restartTestFn: restartTest,
    stopTestFn: stopTest,
    updateMicMeterFn: updateMicMeter,
  }));

  return {
    handleClose,
    startTest,
    stopTest,
    restartTest,
    handleOutputChange,
    handleInputChange,
    handleSelectProcessingMode,
  };
}
