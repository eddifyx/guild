export function buildVoiceSecureDiagnosticsState({
  state = 'idle',
  channelId = null,
  participantCount = 0,
  warning = null,
} = {}) {
  return {
    state,
    channelId,
    participantCount,
    updatedAt: new Date().toISOString(),
    warning,
  };
}

export async function syncVoiceE2EState(participantIds, {
  activeChannelId = null,
  feature = 'Voice chat',
  currentUserId = null,
  currentChannelId = null,
  voiceSafeMode = false,
  getVoiceAudioBypassModeFn = () => null,
  ensureVoiceKeyForParticipantsFn = async () => null,
  getVoiceKeyFn = () => null,
  setVoiceE2EFn = () => {},
  setE2EWarningFn = () => {},
  setJoinErrorFn = () => {},
  updateVoiceDiagnosticsFn = () => {},
  setTimeoutFn = (...args) => globalThis.window?.setTimeout?.(...args) ?? globalThis.setTimeout?.(...args),
} = {}) {
  const bypassVoiceChatE2E = (
    feature === 'Voice chat'
    && (voiceSafeMode || Boolean(getVoiceAudioBypassModeFn({ kind: 'audio', source: 'microphone' })))
  );
  const participantCount = Array.isArray(participantIds) ? participantIds.length : 0;
  const hasOtherParticipants = Array.isArray(participantIds)
    && participantIds.some((id) => id && id !== currentUserId);

  if (bypassVoiceChatE2E) {
    setVoiceE2EFn(true);
    setE2EWarningFn(null);
    updateVoiceDiagnosticsFn((previousDiagnostics) => ({
      ...previousDiagnostics,
      session: {
        ...(previousDiagnostics.session || {}),
        secureVoice: buildVoiceSecureDiagnosticsState({
          state: hasOtherParticipants ? 'bypassed' : 'idle',
          channelId: activeChannelId || null,
          participantCount,
          warning: null,
        }),
      },
    }));
    return getVoiceKeyFn();
  }

  updateVoiceDiagnosticsFn((previousDiagnostics) => ({
    ...previousDiagnostics,
    session: {
      ...(previousDiagnostics.session || {}),
      secureVoice: buildVoiceSecureDiagnosticsState({
        state: hasOtherParticipants ? 'waiting' : 'idle',
        channelId: activeChannelId || null,
        participantCount,
        warning: null,
      }),
    },
  }));

  if (!hasOtherParticipants) {
    setVoiceE2EFn(true);
    setE2EWarningFn(null);
    return getVoiceKeyFn();
  }

  setVoiceE2EFn(false);

  try {
    const voiceKey = await ensureVoiceKeyForParticipantsFn(participantIds, { activeChannelId, feature });
    if (currentChannelId !== activeChannelId) {
      return voiceKey;
    }

    setVoiceE2EFn(true);
    setE2EWarningFn(null);
    setJoinErrorFn((current) => (
      current && current.includes('secure media key') ? null : current
    ));
    updateVoiceDiagnosticsFn((previousDiagnostics) => ({
      ...previousDiagnostics,
      session: {
        ...(previousDiagnostics.session || {}),
        secureVoice: buildVoiceSecureDiagnosticsState({
          state: 'ready',
          channelId: activeChannelId || null,
          participantCount,
          warning: null,
        }),
      },
    }));
    return voiceKey;
  } catch (error) {
    if (currentChannelId !== activeChannelId) {
      return null;
    }

    const message = error?.message || `${feature} is unavailable because the secure media key did not arrive in time.`;
    setVoiceE2EFn(false);
    setE2EWarningFn(message);
    setJoinErrorFn(message);
    setTimeoutFn(() => {
      setJoinErrorFn((current) => (current === message ? null : current));
    }, 5000);
    updateVoiceDiagnosticsFn((previousDiagnostics) => ({
      ...previousDiagnostics,
      session: {
        ...(previousDiagnostics.session || {}),
        secureVoice: buildVoiceSecureDiagnosticsState({
          state: 'waiting',
          channelId: activeChannelId || null,
          participantCount,
          warning: message,
        }),
      },
    }));
    return null;
  }
}
