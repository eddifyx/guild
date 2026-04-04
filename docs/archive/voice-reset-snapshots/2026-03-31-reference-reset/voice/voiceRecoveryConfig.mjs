export const VOICE_RECOVERY_RUNTIME = Object.freeze({
  voiceSafeMode: false,
  // Keep the direct-source fallback available, but prefer the destination
  // track whenever the gain graph is alive so live voice retains the
  // user-facing mic gain stage.
  voiceEmergencyDirectSourceTrack: true,
  // Candidate C from the archived recovery matrix:
  // keep the fresh-capture/Opus changes, and disable voice
  // insertable-stream transport settings for the live channel lane.
  disableOpusDtx: true,
  forceFreshRawMicCapture: true,
  disableVoiceInsertableStreams: true,
});
