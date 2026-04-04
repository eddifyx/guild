import { buildUseVoicePublicApi } from './voiceControllerRuntimeContracts.mjs';
import { useVoiceHookControllerRuntime } from './useVoiceHookControllerRuntime.mjs';

export function useVoiceHookRuntime({
  socket = null,
  userId = null,
  voiceState = {},
  voiceRefs = {},
} = {}) {
  const {
    channelId,
    muted,
    deafened,
    speaking,
    peers,
    joinError,
    screenSharing,
    screenShareStream,
    screenShareError,
    incomingScreenShares,
    screenShareDiagnostics,
    showSourcePicker,
    voiceE2E,
    e2eWarning,
    voiceProcessingMode,
    liveVoiceFallbackReason,
    voiceDiagnostics,
  } = voiceState;

  const {
    joinChannel,
    leaveChannel,
    toggleMute,
    toggleDeafen,
    setOutputDevice,
    setUserVolume,
    setMicGain,
    setVoiceProcessingMode,
    toggleNoiseSuppression,
    startScreenShare,
    stopScreenShare,
    confirmScreenShare,
    cancelSourcePicker,
    clearScreenShareError,
  } = useVoiceHookControllerRuntime({
    socket,
    userId,
    voiceState,
    voiceRefs,
  });

  return buildUseVoicePublicApi({
    state: {
      channelId,
      muted,
      deafened,
      speaking,
      peers,
      joinError,
      voiceProcessingMode,
      voiceDiagnostics,
      liveVoiceFallbackReason,
      screenSharing,
      screenShareStream,
      screenShareDiagnostics,
      incomingScreenShares,
      showSourcePicker,
      screenShareError,
      voiceE2E,
      e2eWarning,
    },
    actions: {
      joinChannel,
      leaveChannel,
      toggleMute,
      toggleDeafen,
      setOutputDevice,
      setUserVolume,
      setMicGain,
      setVoiceProcessingMode,
      toggleNoiseSuppression,
      startScreenShare,
      stopScreenShare,
      confirmScreenShare,
      cancelSourcePicker,
      clearScreenShareError,
    },
  });
}
