export function formatStreamResolution(width, height) {
  if (!width || !height) return '—';
  return `${width}x${height}`;
}

export function formatStreamFps(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10} fps`;
}

export function formatStreamCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return Math.round(value).toString();
}

export function formatStreamMs(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value * 10) / 10} ms`;
}

export function formatStreamKbps(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${Math.round(value).toLocaleString()} kbps`;
}

export function formatStreamTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function getStreamerName({
  voiceChannels = [],
  userId = null,
  fallbackName = 'Unknown',
} = {}) {
  if (!userId) return fallbackName;
  for (const channel of voiceChannels || []) {
    const participant = (channel.participants || []).find((entry) => entry.userId === userId);
    if (participant?.username) return participant.username;
  }
  return fallbackName;
}

export function findActivePeerStreamerId({
  screenSharing = false,
  peers = {},
} = {}) {
  if (screenSharing) return null;
  return Object.entries(peers || {}).find(([, state]) => state?.screenSharing)?.[0] || null;
}

export function findChannelStreamer({
  channelId = null,
  activePeerStreamerId = null,
  voiceChannels = [],
  currentUserId = null,
} = {}) {
  if (!channelId) return null;

  if (activePeerStreamerId) {
    return {
      userId: activePeerStreamerId,
      username: getStreamerName({
        voiceChannels,
        userId: activePeerStreamerId,
      }),
    };
  }

  for (const channel of voiceChannels || []) {
    if (channel.id !== channelId) continue;
    return (channel.participants || []).find((participant) => (
      participant.screenSharing && participant.userId !== currentUserId
    )) || null;
  }

  return null;
}

export function isUserStillSharing({
  targetUserId = null,
  activePeerStreamerId = null,
  voiceChannels = [],
} = {}) {
  if (!targetUserId) return false;
  if (activePeerStreamerId) {
    return activePeerStreamerId === targetUserId;
  }
  return (voiceChannels || []).some((channel) => (
    (channel.participants || []).some((participant) => (
      participant.userId === targetUserId && participant.screenSharing
    ))
  ));
}

export function resolveStreamViewState({
  requestedUserId = null,
  currentUserId = null,
  screenSharing = false,
  screenShareStream = null,
  incomingScreenShares = [],
  voiceChannels = [],
  channelId = null,
  peers = {},
  voiceDiagnostics = null,
} = {}) {
  const isOwnStream = Boolean(requestedUserId && requestedUserId === currentUserId);
  const activePeerStreamerId = findActivePeerStreamerId({
    screenSharing,
    peers,
  });

  if (isOwnStream) {
    return {
      isOwnStream: true,
      showNoStream: !screenSharing,
      ownStreamActive: Boolean(screenSharing),
      ownStreamMedia: screenShareStream,
      streamerName: 'You',
      activePeerStreamerId,
      targetUserId: currentUserId,
      targetUserName: 'You',
      consumerDiagnostics: null,
    };
  }

  let targetUserId = requestedUserId || null;
  if (
    targetUserId
    && !isUserStillSharing({
      targetUserId,
      activePeerStreamerId,
      voiceChannels,
    })
  ) {
    targetUserId = null;
  }

  if (!targetUserId) {
    const channelStreamer = findChannelStreamer({
      channelId,
      activePeerStreamerId,
      voiceChannels,
      currentUserId,
    });
    targetUserId = channelStreamer?.userId || null;
  }

  if (!targetUserId) {
    return {
      isOwnStream: false,
      showNoStream: true,
      activePeerStreamerId,
      targetUserId: null,
      targetUserName: null,
      consumerDiagnostics: null,
    };
  }

  const share = [...(incomingScreenShares || [])]
    .reverse()
    .find((entry) => entry.userId === targetUserId) || null;

  return {
    isOwnStream: false,
    showNoStream: false,
    activePeerStreamerId,
    targetUserId,
    targetUserName: getStreamerName({
      voiceChannels,
      userId: targetUserId,
    }),
    share,
    waitingForShare: !share,
    consumerDiagnostics: share?.producerId
      ? voiceDiagnostics?.consumers?.[share.producerId] || null
      : null,
  };
}
