import { useVoiceSecurityController } from './useVoiceSecurityController.mjs';

export function useVoiceSecurityActionController({
  userId = null,
  state = {},
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  return useVoiceSecurityController({
    userId,
    refs: {
      channelIdRef: refs.channelIdRef,
      participantIdsRef: refs.participantIdsRef,
    },
    setters: {
      setVoiceE2EFn: state.setVoiceE2E,
      setE2EWarningFn: state.setE2EWarning,
      setJoinErrorFn: state.setJoinError,
      setPeersFn: state.setPeers,
    },
    runtime,
    constants,
    deps,
  });
}
