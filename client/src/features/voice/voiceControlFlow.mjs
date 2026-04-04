import { applyDeafenToggle, applyMuteToggle } from './voiceControlState.mjs';
import { VOICE_SOCKET_EVENT_NAMES } from './voiceSocketRuntime.mjs';

export function emitVoiceSpeakingState(socket, channelId, speaking) {
  if (!socket?.emit || !channelId) return false;
  socket.emit(VOICE_SOCKET_EVENT_NAMES.speaking, { channelId, speaking });
  return true;
}

export function emitVoiceMuteState(socket, channelId, muted) {
  if (!socket?.emit || !channelId) return false;
  socket.emit(VOICE_SOCKET_EVENT_NAMES.toggleMute, { channelId, muted });
  return true;
}

export function emitVoiceDeafenState(socket, channelId, deafened) {
  if (!socket?.emit || !channelId) return false;
  socket.emit(VOICE_SOCKET_EVENT_NAMES.toggleDeafen, { channelId, deafened });
  return true;
}

function applyProducerMuteState(producer, muted) {
  if (!producer) return;
  if (muted) {
    producer.pause?.();
    return;
  }
  producer.resume?.();
}

function applyAudioDeafenState(audioElements, deafened) {
  const iterable = Array.isArray(audioElements) ? audioElements : Array.from(audioElements || []);
  for (const audio of iterable) {
    audio.muted = deafened;
  }
}

export function createToggleMuteAction({
  socket,
  getCurrentChannelId = () => null,
  getCurrentControlState = () => ({ muted: false, deafened: false, mutedBeforeDeafen: false }),
  setMutedBeforeDeafen = () => {},
  setMuted = () => {},
  setSpeaking = () => {},
  getProducer = () => null,
  clearVoiceHealthProbe = () => {},
  resetVoiceHealthProbeRetries = () => {},
  scheduleVoiceHealthProbe = () => {},
} = {}) {
  return function toggleMute() {
    const channelId = getCurrentChannelId();
    if (!channelId || !socket) return false;

    const nextState = applyMuteToggle(getCurrentControlState());
    setMutedBeforeDeafen(nextState.mutedBeforeDeafen);
    setMuted(nextState.muted);
    applyProducerMuteState(getProducer(), nextState.muted);

    if (nextState.shouldEmitSpeakingFalse) {
      clearVoiceHealthProbe();
      resetVoiceHealthProbeRetries();
      setSpeaking(false);
      emitVoiceSpeakingState(socket, channelId, false);
    } else if (nextState.shouldScheduleHealthProbe) {
      resetVoiceHealthProbeRetries();
      scheduleVoiceHealthProbe(channelId, {
        delayMs: 1500,
        reason: 'unmute',
      });
    }

    emitVoiceMuteState(socket, channelId, nextState.muted);
    return nextState;
  };
}

export function createToggleDeafenAction({
  socket,
  getCurrentChannelId = () => null,
  getCurrentControlState = () => ({ muted: false, deafened: false, mutedBeforeDeafen: false }),
  setMutedBeforeDeafen = () => {},
  setDeafened = () => {},
  setMuted = () => {},
  setSpeaking = () => {},
  getProducer = () => null,
  getAudioElements = () => [],
  clearVoiceHealthProbe = () => {},
  resetVoiceHealthProbeRetries = () => {},
  scheduleVoiceHealthProbe = () => {},
} = {}) {
  return function toggleDeafen() {
    const channelId = getCurrentChannelId();
    if (!channelId || !socket) return false;

    const nextState = applyDeafenToggle(getCurrentControlState());
    setMutedBeforeDeafen(nextState.mutedBeforeDeafen);
    setDeafened(nextState.deafened);
    applyAudioDeafenState(getAudioElements(), nextState.deafened);

    if (nextState.shouldEmitSpeakingFalse) {
      clearVoiceHealthProbe();
      resetVoiceHealthProbeRetries();
      setSpeaking(false);
      emitVoiceSpeakingState(socket, channelId, false);
    }

    setMuted(nextState.muted);
    applyProducerMuteState(getProducer(), nextState.muted);

    if (nextState.shouldEmitMuteUpdate) {
      emitVoiceMuteState(socket, channelId, nextState.muted);
    }

    if (nextState.shouldScheduleHealthProbe) {
      resetVoiceHealthProbeRetries();
      scheduleVoiceHealthProbe(channelId, {
        delayMs: 1500,
        reason: 'undeafen',
      });
    }

    emitVoiceDeafenState(socket, channelId, nextState.deafened);
    return nextState;
  };
}
