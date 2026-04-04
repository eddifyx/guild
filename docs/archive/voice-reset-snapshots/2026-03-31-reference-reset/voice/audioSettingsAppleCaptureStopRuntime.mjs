export async function stopAudioSettingsAppleCapture({
  stopAppleVoiceCaptureFn = null,
  stopAppleVoiceCaptureArgs = [],
} = {}) {
  if (!stopAppleVoiceCaptureFn) {
    return;
  }

  try {
    await stopAppleVoiceCaptureFn(...stopAppleVoiceCaptureArgs);
  } catch {}
}
