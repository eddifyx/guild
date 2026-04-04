export function buildUseVoiceHookActionSessionStateOptions({
  state = {},
  refs = {},
  setVoiceChannelIdFn = null,
} = {}) {
  const {
    setChannelId,
    setMuted,
    setDeafened,
    setJoinError,
    setE2EWarning,
    setLiveVoiceFallbackReason,
    updateVoiceDiagnostics,
  } = state;
  const { deviceRef, joinGenRef } = refs;

  return {
    updateVoiceDiagnosticsFn: updateVoiceDiagnostics,
    setVoiceChannelIdFn: typeof setVoiceChannelIdFn === 'function' ? setVoiceChannelIdFn : setChannelId,
    joinGenRef,
    deviceRef,
    setJoinErrorFn: setJoinError,
    setE2EWarningFn: setE2EWarning,
    setLiveVoiceFallbackReasonFn: setLiveVoiceFallbackReason,
    setChannelIdFn: setChannelId,
    setDeafenedFn: setDeafened,
    setMutedFn: setMuted,
  };
}
