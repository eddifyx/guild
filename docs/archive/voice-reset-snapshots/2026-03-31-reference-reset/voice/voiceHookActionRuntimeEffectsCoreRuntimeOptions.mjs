export function buildUseVoiceHookActionRuntimeEffectsCoreRuntimeOptions({
  coreRuntime = {},
} = {}) {
  const {
    maybeAdaptScreenShareProfile,
    syncVoiceE2EState,
    getUntrustedVoiceParticipants,
    buildVoiceTrustError,
    syncVoiceParticipants,
    cleanupRemoteProducer,
    consumeProducer,
    resumeVoiceMediaAfterKeyUpdate,
  } = coreRuntime;

  return {
    getUntrustedVoiceParticipantsFn: getUntrustedVoiceParticipants,
    buildVoiceTrustErrorFn: buildVoiceTrustError,
    syncVoiceParticipantsFn: syncVoiceParticipants,
    syncVoiceE2EStateFn: syncVoiceE2EState,
    cleanupRemoteProducerFn: cleanupRemoteProducer,
    consumeProducerFn: consumeProducer,
    resumeVoiceMediaAfterKeyUpdateFn: resumeVoiceMediaAfterKeyUpdate,
    maybeAdaptScreenShareProfileFn: maybeAdaptScreenShareProfile,
  };
}
