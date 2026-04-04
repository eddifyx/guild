import { useVoiceCaptureController } from './useVoiceCaptureController.mjs';

export function useVoiceCaptureActionController({
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useVoiceCaptureController({
    refs: {
      vadIntervalRef: refs.vadIntervalRef,
      mutedRef: refs.mutedRef,
      channelIdRef: refs.channelIdRef,
      liveCaptureConfigGenRef: refs.liveCaptureConfigGenRef,
      liveCaptureRef: refs.liveCaptureRef,
      producerRef: refs.producerRef,
      sendTransportRef: refs.sendTransportRef,
      pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
      voiceHealthProbeTimeoutRef: refs.voiceHealthProbeTimeoutRef,
      voiceHealthProbeRetryCountRef: refs.voiceHealthProbeRetryCountRef,
    },
    setters: {
      setSpeakingFn: state.setSpeaking,
      setLiveVoiceFallbackReasonFn: state.setLiveVoiceFallbackReason,
      setMutedFn: state.setMuted,
    },
    runtime,
    constants,
    deps,
  });
}
