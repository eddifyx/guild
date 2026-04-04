import { useVoiceMediaController } from './useVoiceMediaController.mjs';

export function useVoiceMediaActionController({
  refs = {},
  runtime = {},
  deps = [],
} = {}) {
  return useVoiceMediaController({
    refs: {
      screenShareVideosRef: refs.screenShareVideosRef,
      userAudioRef: refs.userAudioRef,
      consumersRef: refs.consumersRef,
      audioElementsRef: refs.audioElementsRef,
      producerMetaRef: refs.producerMetaRef,
      producerUserMapRef: refs.producerUserMapRef,
    },
    runtime,
    deps,
  });
}
