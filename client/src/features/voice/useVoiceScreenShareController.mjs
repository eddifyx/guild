import { useCallback, useMemo } from 'react';

import { createVoiceScreenShareActions } from './voiceScreenShareControlFlow.mjs';
import { buildVoiceScreenShareActionContract } from './voiceControllerRuntimeContracts.mjs';

export function useVoiceScreenShareController({
  refs = {},
  runtime = {},
  constants = {},
  deps = [],
} = {}) {
  const voiceScreenShareActions = useMemo(() => createVoiceScreenShareActions(buildVoiceScreenShareActionContract({
    refs,
    runtime,
    constants,
    getPlatformFn: runtime.getPlatformFn,
    runVoiceScreenShareStartFlowFn: runtime.runVoiceScreenShareStartFlowFn,
  })), deps);

  const confirmScreenShare = useCallback(async (options) => {
    await voiceScreenShareActions.confirmScreenShare(options);
  }, [voiceScreenShareActions]);

  const startScreenShare = useCallback(async () => {
    voiceScreenShareActions.startScreenShare();
  }, [voiceScreenShareActions]);

  const cancelSourcePicker = useCallback(() => {
    voiceScreenShareActions.cancelSourcePicker();
  }, [voiceScreenShareActions]);

  const stopScreenShare = useCallback(() => {
    void voiceScreenShareActions.stopScreenShare();
  }, [voiceScreenShareActions]);

  const clearScreenShareError = useCallback(() => {
    voiceScreenShareActions.clearScreenShareError();
  }, [voiceScreenShareActions]);

  if (refs.stopScreenShareRef) {
    refs.stopScreenShareRef.current = stopScreenShare;
  }

  return {
    voiceScreenShareActions,
    confirmScreenShare,
    startScreenShare,
    cancelSourcePicker,
    stopScreenShare,
    clearScreenShareError,
  };
}
