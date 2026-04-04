export async function cleanupAudioSettingsAppleRefs({
  appleVoiceFrameCleanupRef = { current: null },
  appleVoiceStateCleanupRef = { current: null },
  appleVoiceSourceNodeRef = { current: null },
  previewAudioRef = { current: null },
  audioCtxRef = { current: null },
} = {}) {
  if (appleVoiceFrameCleanupRef.current) {
    appleVoiceFrameCleanupRef.current();
    appleVoiceFrameCleanupRef.current = null;
  }

  if (appleVoiceStateCleanupRef.current) {
    appleVoiceStateCleanupRef.current();
    appleVoiceStateCleanupRef.current = null;
  }

  if (appleVoiceSourceNodeRef.current) {
    try {
      appleVoiceSourceNodeRef.current.port.postMessage({ type: 'reset' });
    } catch {}

    try {
      appleVoiceSourceNodeRef.current.disconnect?.();
    } catch {}

    appleVoiceSourceNodeRef.current = null;
  }

  if (previewAudioRef.current) {
    previewAudioRef.current.pause();
    previewAudioRef.current.srcObject = null;
    previewAudioRef.current.src = '';
    previewAudioRef.current = null;
  }

  if (audioCtxRef.current) {
    try {
      await audioCtxRef.current.close();
    } catch {}

    audioCtxRef.current = null;
  }
}
