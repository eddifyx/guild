export const VOICE_RECOVERY_RUNTIME = Object.freeze({
  // Controlled baseline rebuild:
  // keep live voice on one plain, boring lane until audibility is proven.
  referenceVoiceLane: true,
  voiceSafeMode: true,
  voiceEmergencyDirectSourceTrack: false,
  disableOpusDtx: true,
  forceFreshRawMicCapture: true,
  disableVoiceInsertableStreams: true,
});
