export function syncUseVoiceHookCoreRuntimeDeps({
  screenShare = {},
  security = {},
  mediaTransport = {},
} = {}) {
  screenShare.syncScreenShareRuntimeDeps?.({
    ensureSecureMediaReadyFn: security.ensureSecureMediaReady,
    ensureVoiceKeyForParticipantsFn: security.ensureVoiceKeyForParticipants,
    getOrCreateScreenSendTransportFn: mediaTransport.getOrCreateScreenSendTransport,
    cleanupScreenShareSessionFn: mediaTransport.cleanupScreenShareSession,
  });
}
