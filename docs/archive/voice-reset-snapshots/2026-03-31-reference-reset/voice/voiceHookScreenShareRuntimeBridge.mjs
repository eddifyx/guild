export function createVoiceHookScreenShareRuntimeDeps() {
  return {
    ensureSecureMediaReadyFn: async () => true,
    ensureVoiceKeyForParticipantsFn: async () => {},
    getOrCreateScreenSendTransportFn: async () => null,
    cleanupScreenShareSessionFn: () => {},
  };
}

export function syncVoiceHookScreenShareRuntimeDeps(
  depsRef,
  {
    ensureSecureMediaReadyFn,
    ensureVoiceKeyForParticipantsFn,
    getOrCreateScreenSendTransportFn,
    cleanupScreenShareSessionFn,
  } = {},
) {
  if (!depsRef?.current) {
    return null;
  }

  depsRef.current.ensureSecureMediaReadyFn = ensureSecureMediaReadyFn;
  depsRef.current.ensureVoiceKeyForParticipantsFn = ensureVoiceKeyForParticipantsFn;
  depsRef.current.getOrCreateScreenSendTransportFn = getOrCreateScreenSendTransportFn;
  depsRef.current.cleanupScreenShareSessionFn = cleanupScreenShareSessionFn;
  return depsRef.current;
}

export function createVoiceHookScreenShareRuntimeBridge({
  depsRef,
} = {}) {
  return {
    ensureSecureMediaReadyFn: (...args) => (
      depsRef?.current?.ensureSecureMediaReadyFn?.(...args)
    ),
    ensureVoiceKeyForParticipantsFn: (...args) => (
      depsRef?.current?.ensureVoiceKeyForParticipantsFn?.(...args)
    ),
    getOrCreateScreenSendTransportFn: (...args) => (
      depsRef?.current?.getOrCreateScreenSendTransportFn?.(...args)
    ),
    cleanupScreenShareSessionFn: (...args) => (
      depsRef?.current?.cleanupScreenShareSessionFn?.(...args)
    ),
  };
}
