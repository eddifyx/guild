export function buildUseVoiceHookScreenShareRuntime({
  ensureSecureMediaReadyFn,
  ensureVoiceKeyForParticipantsFn,
  getOrCreateScreenSendTransportFn,
  cleanupScreenShareSessionFn,
} = {}) {
  return {
    ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn,
    cleanupScreenShareSessionFn,
  };
}
