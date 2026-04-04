import { useVoiceUiController } from './useVoiceUiController.mjs';

export function useVoiceUiActionController({
  state = {},
  refs = {},
  runtime = {},
  deps = [],
} = {}) {
  return useVoiceUiController({
    refs: {
      channelIdRef: refs.channelIdRef,
      mutedRef: refs.mutedRef,
      deafenedRef: refs.deafenedRef,
      mutedBeforeDeafenRef: refs.mutedBeforeDeafenRef,
      producerRef: refs.producerRef,
      audioElementsRef: refs.audioElementsRef,
      voiceHealthProbeRetryCountRef: refs.voiceHealthProbeRetryCountRef,
      pendingLiveReconfigureRef: refs.pendingLiveReconfigureRef,
      pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
      voiceProcessingModeRef: refs.voiceProcessingModeRef,
      micGainNodeRef: refs.micGainNodeRef,
      userAudioRef: refs.userAudioRef,
    },
    setters: {
      setMutedFn: state.setMuted,
      setSpeakingFn: state.setSpeaking,
      setDeafenedFn: state.setDeafened,
      setVoiceProcessingModeStateFn: state.setVoiceProcessingModeState,
      setLiveVoiceFallbackReasonFn: state.setLiveVoiceFallbackReason,
    },
    runtime,
    deps,
  });
}
