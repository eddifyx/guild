import { useVoiceRuntimeController } from './useVoiceRuntimeController.mjs';

export function useVoiceRuntimeBindingsController({
  state = {},
  refs = {},
  runtime = {},
} = {}) {
  useVoiceRuntimeController({
    state: {
      voiceProcessingMode: state.voiceProcessingMode,
      channelId: state.channelId,
      muted: state.muted,
      deafened: state.deafened,
      screenShareDiagnostics: state.screenShareDiagnostics,
      screenSharing: state.screenSharing,
    },
    refs: {
      voiceProcessingModeRef: refs.voiceProcessingModeRef,
      channelIdRef: refs.channelIdRef,
      mutedRef: refs.mutedRef,
      deafenedRef: refs.deafenedRef,
      appleVoiceAvailableRef: refs.appleVoiceAvailableRef,
      producerUserMapRef: refs.producerUserMapRef,
      participantIdsRef: refs.participantIdsRef,
      producerRef: refs.producerRef,
      consumersRef: refs.consumersRef,
      producerMetaRef: refs.producerMetaRef,
      pendingLiveReconfigureRef: refs.pendingLiveReconfigureRef,
      screenShareProducerRef: refs.screenShareProducerRef,
      screenShareStreamRef: refs.screenShareStreamRef,
      screenShareStatsRef: refs.screenShareStatsRef,
      screenShareProfileIndexRef: refs.screenShareProfileIndexRef,
      screenShareSimulcastEnabledRef: refs.screenShareSimulcastEnabledRef,
      screenShareAdaptationRef: refs.screenShareAdaptationRef,
      leaveChannelRef: refs.leaveChannelRef,
    },
    runtime,
  });
}
