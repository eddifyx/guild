export function getDefaultVoiceControlState() {
  return {
    muted: false,
    deafened: false,
    mutedBeforeDeafen: false,
    speaking: false,
  };
}

export function applyMuteToggle({
  muted = false,
  deafened = false,
  mutedBeforeDeafen = false,
} = {}) {
  const nextMuted = !Boolean(muted);

  return {
    muted: nextMuted,
    deafened: Boolean(deafened),
    mutedBeforeDeafen: Boolean(deafened) ? Boolean(mutedBeforeDeafen) : nextMuted,
    shouldEmitSpeakingFalse: nextMuted,
    shouldScheduleHealthProbe: !nextMuted,
  };
}

export function applyDeafenToggle({
  muted = false,
  deafened = false,
  mutedBeforeDeafen = false,
} = {}) {
  const nextDeafened = !Boolean(deafened);

  if (nextDeafened) {
    return {
      muted: true,
      deafened: true,
      mutedBeforeDeafen: Boolean(muted),
      shouldEmitSpeakingFalse: true,
      shouldEmitMuteUpdate: !Boolean(muted),
      shouldScheduleHealthProbe: false,
    };
  }

  const restoredMuted = Boolean(mutedBeforeDeafen);
  return {
    muted: restoredMuted,
    deafened: false,
    mutedBeforeDeafen: restoredMuted,
    shouldEmitSpeakingFalse: false,
    shouldEmitMuteUpdate: true,
    shouldScheduleHealthProbe: !restoredMuted,
  };
}
