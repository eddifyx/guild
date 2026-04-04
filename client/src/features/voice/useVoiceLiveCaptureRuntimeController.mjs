import { useVoiceLiveCaptureBindingsController } from './useVoiceLiveCaptureBindingsController.mjs';

export function useVoiceLiveCaptureRuntimeController({
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useVoiceLiveCaptureBindingsController({
    refs: {
      voiceHealthProbeTimeoutRef: refs.voiceHealthProbeTimeoutRef,
      liveCaptureRef: refs.liveCaptureRef,
      pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
      localStreamRef: refs.localStreamRef,
      micAudioCtxRef: refs.micAudioCtxRef,
      micGainNodeRef: refs.micGainNodeRef,
      noiseSuppressorNodeRef: refs.noiseSuppressorNodeRef,
      residualDenoiserNodeRef: refs.residualDenoiserNodeRef,
      noiseGateNodeRef: refs.noiseGateNodeRef,
      speechFocusChainRef: refs.speechFocusChainRef,
      keyboardSuppressorNodeRef: refs.keyboardSuppressorNodeRef,
      noiseSuppressionRoutingRef: refs.noiseSuppressionRoutingRef,
      appleVoiceFrameCleanupRef: refs.appleVoiceFrameCleanupRef,
      appleVoiceStateCleanupRef: refs.appleVoiceStateCleanupRef,
      appleVoiceSourceNodeRef: refs.appleVoiceSourceNodeRef,
      appleVoiceAvailableRef: refs.appleVoiceAvailableRef,
    },
    setters: {
      setLiveVoiceFallbackReasonFn: state.setLiveVoiceFallbackReason,
    },
    runtime,
    constants,
    deps,
  });
}
