export function buildAudioSettingsAppleCleanupInput({
  refs = {},
  stopAppleVoiceCaptureFn,
} = {}) {
  return {
    refs: {
      appleVoiceFrameCleanupRef: refs.appleVoiceFrameCleanupRef,
      appleVoiceStateCleanupRef: refs.appleVoiceStateCleanupRef,
      appleVoiceSourceNodeRef: refs.appleVoiceSourceNodeRef,
      previewAudioRef: refs.previewAudioRef,
      audioCtxRef: refs.audioCtxRef,
    },
    deps: {
      stopAppleVoiceCaptureFn,
    },
  };
}
