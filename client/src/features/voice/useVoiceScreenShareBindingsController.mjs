import { useVoiceScreenShareRuntimeController } from './useVoiceScreenShareRuntimeController.mjs';

export function useVoiceScreenShareBindingsController({
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useVoiceScreenShareRuntimeController({
    refs: {
      deviceRef: refs.deviceRef,
      screenSendTransportRef: refs.screenSendTransportRef,
      screenShareStreamRef: refs.screenShareStreamRef,
      screenShareProducerRef: refs.screenShareProducerRef,
      screenShareStatsRef: refs.screenShareStatsRef,
      screenShareProfileIndexRef: refs.screenShareProfileIndexRef,
      screenShareSimulcastEnabledRef: refs.screenShareSimulcastEnabledRef,
      screenSharePromotionInFlightRef: refs.screenSharePromotionInFlightRef,
      screenSharePromotionCooldownUntilRef: refs.screenSharePromotionCooldownUntilRef,
      screenShareAdaptationRef: refs.screenShareAdaptationRef,
    },
    setters: {
      setScreenShareDiagnosticsFn: state.setScreenShareDiagnostics,
    },
    runtime,
    constants,
    deps,
  });
}
