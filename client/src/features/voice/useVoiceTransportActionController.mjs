import { useVoiceTransportController } from './useVoiceTransportController.mjs';

export function useVoiceTransportActionController({
  currentUserId = null,
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useVoiceTransportController({
    currentUserId,
    refs: {
      deviceRef: refs.deviceRef,
      sendTransportRef: refs.sendTransportRef,
      screenSendTransportRef: refs.screenSendTransportRef,
      screenShareAudioProducerRef: refs.screenShareAudioProducerRef,
      screenShareProducerRef: refs.screenShareProducerRef,
      screenShareStreamRef: refs.screenShareStreamRef,
      screenShareStatsRef: refs.screenShareStatsRef,
      recvTransportRef: refs.recvTransportRef,
      consumersRef: refs.consumersRef,
      producerUserMapRef: refs.producerUserMapRef,
      producerMetaRef: refs.producerMetaRef,
      screenShareVideosRef: refs.screenShareVideosRef,
      audioElementsRef: refs.audioElementsRef,
      deafenedRef: refs.deafenedRef,
    },
    runtime,
    constants,
    deps,
  });
}
