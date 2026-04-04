export function createAudioSettingsMonitorPreviewAudio({
  audioCtor = globalThis.Audio,
  previewDestination = { stream: null },
  previewAudioRef = { current: null },
  ensureVoiceAudioHostFn = () => null,
} = {}) {
  const previewAudio = new audioCtor();
  previewAudio.srcObject = previewDestination.stream;
  previewAudio.autoplay = true;
  previewAudio.playsInline = true;
  previewAudio.volume = 1;
  previewAudio.muted = false;
  previewAudio.defaultMuted = false;
  previewAudio.style?.setProperty?.('position', 'absolute');
  previewAudio.style?.setProperty?.('width', '1px');
  previewAudio.style?.setProperty?.('height', '1px');
  previewAudio.style?.setProperty?.('opacity', '0.001');
  previewAudio.style?.setProperty?.('pointer-events', 'none');
  const host = ensureVoiceAudioHostFn();
  if (host && previewAudio.parentNode !== host) {
    host.appendChild(previewAudio);
  }
  previewAudioRef.current = previewAudio;
  return previewAudio;
}
