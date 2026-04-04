export function buildUseVoiceHookActionRuntimeEffectsStateOptions({
  state = {},
} = {}) {
  const {
    setPeers,
    setJoinError,
    setScreenShareDiagnostics,
    setVoiceE2E,
    setE2EWarning,
    updateVoiceDiagnostics,
  } = state;

  return {
    setJoinErrorFn: setJoinError,
    setVoiceE2EFn: setVoiceE2E,
    setE2EWarningFn: setE2EWarning,
    setPeersFn: setPeers,
    updateVoiceDiagnosticsFn: updateVoiceDiagnostics,
    setScreenShareDiagnosticsFn: setScreenShareDiagnostics,
  };
}
