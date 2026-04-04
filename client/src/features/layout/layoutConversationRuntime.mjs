function buildOwnStreamLabel(username) {
  return `${username || 'Your'}'s Stream`;
}

function buildRemoteStreamLabel(streamer) {
  return `${streamer?.username || 'Stream'}'s Stream`;
}

function hasActiveVoiceStream({ screenSharing, channelId, voiceChannels } = {}) {
  return !!(
    screenSharing
    || (channelId && (voiceChannels || []).some((channel) => (
      channel.id === channelId && (channel.participants || []).some((participant) => participant.screenSharing)
    )))
  );
}

export function syncScreenShareConversationState({
  screenSharing,
  conversation,
  conversationName,
  userId,
  username,
  prevConversationRef,
  prevConversationNameRef,
  setConversationFn,
  setConversationNameFn,
} = {}) {
  if (screenSharing) {
    prevConversationRef.current = conversation;
    prevConversationNameRef.current = conversationName;
    setConversationFn?.({ type: 'stream', id: userId });
    setConversationNameFn?.(buildOwnStreamLabel(username));
    return 'started';
  }

  if (prevConversationRef?.current !== undefined) {
    setConversationFn?.(prevConversationRef.current);
    setConversationNameFn?.(prevConversationNameRef.current || '');
    prevConversationRef.current = undefined;
    prevConversationNameRef.current = undefined;
    return 'restored';
  }

  return 'noop';
}

export function syncActiveStreamConversationState({
  screenSharing,
  channelId,
  activeVoiceChannel,
  activeRemoteStreamer,
  streamConversationMatchesActiveVoice,
  conversationType,
  conversationId,
  setConversationFn,
  setConversationNameFn,
} = {}) {
  if (screenSharing || !channelId || !activeVoiceChannel) return 'noop';

  if (conversationType === 'voice' && conversationId === channelId && activeRemoteStreamer) {
    setConversationFn?.({ type: 'stream', id: activeRemoteStreamer.userId });
    setConversationNameFn?.(buildRemoteStreamLabel(activeRemoteStreamer));
    return 'promoted-to-stream';
  }

  if (conversationType === 'stream' && streamConversationMatchesActiveVoice) {
    if (activeRemoteStreamer) {
      if (conversationId !== activeRemoteStreamer.userId) {
        setConversationFn?.({ type: 'stream', id: activeRemoteStreamer.userId });
        setConversationNameFn?.(buildRemoteStreamLabel(activeRemoteStreamer));
        return 'retargeted-stream';
      }
      return 'stream-unchanged';
    }

    setConversationFn?.({ type: 'voice', id: channelId });
    setConversationNameFn?.(activeVoiceChannel.name || 'Voice');
    return 'demoted-to-voice';
  }

  return 'noop';
}

export function syncPiPVisibilityState({
  conversationType,
  screenSharing,
  channelId,
  voiceChannels,
  prevConversationTypeRef,
  setShowPiPFn,
} = {}) {
  const previousType = prevConversationTypeRef?.current;
  if (prevConversationTypeRef) {
    prevConversationTypeRef.current = conversationType;
  }

  if (previousType === 'stream' && conversationType !== 'stream') {
    if (hasActiveVoiceStream({ screenSharing, channelId, voiceChannels })) {
      setShowPiPFn?.(true);
      return 'show';
    }
  }

  if (conversationType === 'stream') {
    setShowPiPFn?.(false);
    return 'hide';
  }

  return 'noop';
}

export function syncJoinedVoiceConversationState({
  channelId,
  activeVoiceChannel,
  activeRemoteStreamer,
  screenSharing,
  conversationType,
  prevJoinedVoiceChannelIdRef,
  setConversationFn,
  setConversationNameFn,
} = {}) {
  if (channelId) {
    if (prevJoinedVoiceChannelIdRef?.current === channelId) return 'noop';
    if (!activeVoiceChannel) return 'noop';

    prevJoinedVoiceChannelIdRef.current = channelId;
    if (screenSharing) return 'noop';

    if (activeRemoteStreamer) {
      setConversationFn?.({ type: 'stream', id: activeRemoteStreamer.userId });
      setConversationNameFn?.(buildRemoteStreamLabel(activeRemoteStreamer));
      return 'joined-stream';
    }

    setConversationFn?.({ type: 'voice', id: channelId });
    setConversationNameFn?.(activeVoiceChannel.name || 'Voice');
    return 'joined-voice';
  }

  if (!channelId && prevJoinedVoiceChannelIdRef?.current) {
    prevJoinedVoiceChannelIdRef.current = null;
    if (conversationType === 'voice' || conversationType === 'stream') {
      setConversationFn?.(null);
      setConversationNameFn?.('');
      return 'cleared';
    }
  }

  return 'noop';
}
