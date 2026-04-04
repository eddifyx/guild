import {
  createToggleDeafenAction,
  createToggleMuteAction,
} from './voiceControlFlow.mjs';
import {
  applyVoiceProcessingModeChange,
  toggleVoiceNoiseSuppression,
} from './voiceModeControlFlow.mjs';
import {
  applyVoiceOutputDeviceToAll,
  persistStoredMicGain,
  persistStoredUserVolume,
} from './voicePreferences.mjs';

export function createVoiceUiActions({
  refs = {},
  setters = {},
  runtime = {},
} = {}) {
  const toggleMute = createToggleMuteAction({
    socket: runtime.socket,
    getCurrentChannelId: () => refs.channelIdRef.current,
    getCurrentControlState: () => ({
      muted: refs.mutedRef.current,
      deafened: refs.deafenedRef.current,
      mutedBeforeDeafen: refs.mutedBeforeDeafenRef.current,
    }),
    setMutedBeforeDeafen: (nextValue) => {
      refs.mutedBeforeDeafenRef.current = nextValue;
    },
    setMuted: setters.setMutedFn,
    setSpeaking: setters.setSpeakingFn,
    getProducer: () => refs.producerRef.current,
    clearVoiceHealthProbe: runtime.clearVoiceHealthProbeFn,
    resetVoiceHealthProbeRetries: () => {
      refs.voiceHealthProbeRetryCountRef.current = 0;
    },
    scheduleVoiceHealthProbe: runtime.scheduleVoiceHealthProbeFn,
  });

  const toggleDeafen = createToggleDeafenAction({
    socket: runtime.socket,
    getCurrentChannelId: () => refs.channelIdRef.current,
    getCurrentControlState: () => ({
      muted: refs.mutedRef.current,
      deafened: refs.deafenedRef.current,
      mutedBeforeDeafen: refs.mutedBeforeDeafenRef.current,
    }),
    setMutedBeforeDeafen: (nextValue) => {
      refs.mutedBeforeDeafenRef.current = nextValue;
    },
    setDeafened: setters.setDeafenedFn,
    setMuted: setters.setMutedFn,
    setSpeaking: setters.setSpeakingFn,
    getProducer: () => refs.producerRef.current,
    getAudioElements: () => refs.audioElementsRef.current.values(),
    clearVoiceHealthProbe: runtime.clearVoiceHealthProbeFn,
    resetVoiceHealthProbeRetries: () => {
      refs.voiceHealthProbeRetryCountRef.current = 0;
    },
    scheduleVoiceHealthProbe: runtime.scheduleVoiceHealthProbeFn,
  });

  function scheduleLiveVoiceReconfigure(perfTraceId = null) {
    return runtime.scheduleVoiceLiveReconfigureFlowFn({
      perfTraceId,
      refs: {
        channelIdRef: refs.channelIdRef,
        pendingLiveReconfigureRef: refs.pendingLiveReconfigureRef,
        pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
      },
      clearTimeoutFn: runtime.clearTimeoutFn,
      setTimeoutFn: runtime.setTimeoutFn,
      cancelPerfTraceFn: runtime.cancelPerfTraceFn,
      addPerfPhaseFn: runtime.addPerfPhaseFn,
      reconfigureLiveCaptureFn: runtime.reconfigureLiveCaptureFn,
    });
  }

  function setVoiceProcessingMode(mode, { perfSource = 'unknown', uiTraceId = null } = {}) {
    return applyVoiceProcessingModeChange({
      mode,
      perfSource,
      uiTraceId,
      refs: {
        channelIdRef: refs.channelIdRef,
        voiceProcessingModeRef: refs.voiceProcessingModeRef,
        pendingVoiceModeSwitchTraceRef: refs.pendingVoiceModeSwitchTraceRef,
        pendingLiveReconfigureRef: refs.pendingLiveReconfigureRef,
      },
      setVoiceProcessingModeStateFn: setters.setVoiceProcessingModeStateFn,
      setLiveVoiceFallbackReasonFn: setters.setLiveVoiceFallbackReasonFn,
      startPerfTraceFn: runtime.startPerfTraceFn,
      cancelPerfTraceFn: runtime.cancelPerfTraceFn,
      addPerfPhaseFn: runtime.addPerfPhaseFn,
      endPerfTraceFn: runtime.endPerfTraceFn,
      clearTimeoutFn: runtime.clearTimeoutFn,
      switchLiveCaptureModeInPlaceFn: runtime.switchLiveCaptureModeInPlaceFn,
      applyNoiseSuppressionRoutingFn: runtime.applyNoiseSuppressionRoutingFn,
      scheduleLiveVoiceReconfigureFn: scheduleLiveVoiceReconfigure,
      applyVoiceModeDependenciesFn: runtime.applyVoiceModeDependenciesFn,
      persistVoiceProcessingModeFn: runtime.persistVoiceProcessingModeFn,
      persistNoiseSuppressionEnabledFn: runtime.persistNoiseSuppressionEnabledFn,
      isUltraLowLatencyModeFn: runtime.isUltraLowLatencyModeFn,
    });
  }

  function toggleNoiseSuppression(enabled) {
    return toggleVoiceNoiseSuppression({
      enabled,
      setVoiceProcessingModeFn: setVoiceProcessingMode,
    });
  }

  function setMicGain(gain) {
    if (refs.micGainNodeRef.current) {
      refs.micGainNodeRef.current.gain.value = gain;
    }
    persistStoredMicGain(gain);
  }

  function setUserVolume(userId, volume) {
    const userAudioEntries = refs.userAudioRef.current.get(userId);
    if (userAudioEntries) {
      for (const audio of userAudioEntries.values()) {
        audio.volume = volume;
      }
    }
    persistStoredUserVolume(userId, volume);
  }

  function setOutputDevice(deviceId) {
    applyVoiceOutputDeviceToAll(refs.audioElementsRef.current.values(), deviceId || 'default');
  }

  return {
    toggleMute,
    toggleDeafen,
    scheduleLiveVoiceReconfigure,
    setVoiceProcessingMode,
    toggleNoiseSuppression,
    setMicGain,
    setUserVolume,
    setOutputDevice,
  };
}
