export function parseMutedUsers(rawValue) {
  try {
    const parsed = JSON.parse(rawValue || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function buildOnlineUsersById(onlineUsers = []) {
  return new Map(onlineUsers.map((entry) => [entry.userId, entry]));
}

export function getStoredUserVolumePercent(userId, {
  volumes = {},
  storage = globalThis.localStorage,
} = {}) {
  if (volumes[userId] !== undefined) return volumes[userId];
  const saved = storage?.getItem?.(`voice:userVolume:${userId}`);
  if (saved !== null && saved !== undefined) {
    return Math.round(parseFloat(saved) * 100);
  }
  return 100;
}

export function buildParticipantVoiceState(participant, {
  currentUserId = null,
  activeChannelId = null,
  channelId = null,
  selfSpeaking = false,
  peers = {},
} = {}) {
  const isSelf = participant.userId === currentUserId;
  const peerState = peers[participant.userId];

  return {
    speaking: isSelf ? (channelId === activeChannelId && selfSpeaking) : (peerState?.speaking || false),
    muted: peerState?.muted ?? participant.muted ?? false,
    deafened: peerState?.deafened ?? participant.deafened ?? false,
    screenSharing: peerState?.screenSharing ?? participant.screenSharing ?? false,
  };
}

export function buildVoiceRecoveryHint(joinError) {
  if (!joinError) return null;
  if (!joinError.toLowerCase().includes('temporarily unavailable')) return null;
  return 'Voice workers are recovering. Wait a moment, then try joining again.';
}

export function buildProactiveVoiceNotice(voiceStatus) {
  if (!voiceStatus || voiceStatus.status === 'ok' || voiceStatus.status === 'unknown') return null;

  if (voiceStatus.status === 'recovering') {
    return {
      tone: 'warning',
      title: 'Voice is recovering',
      detail: `Workers online: ${voiceStatus.workerCount}/${voiceStatus.targetWorkerCount || voiceStatus.workerCount || 0}. Joining may fail briefly while recovery finishes.`,
    };
  }

  if (voiceStatus.status === 'degraded') {
    return {
      tone: 'warning',
      title: 'Voice capacity is degraded',
      detail: `Workers online: ${voiceStatus.workerCount}/${voiceStatus.targetWorkerCount || voiceStatus.workerCount || 0}. Voice should still work, but recovery is in progress.`,
    };
  }

  return {
    tone: 'danger',
    title: 'Voice is temporarily unavailable',
    detail: 'The server voice stack is offline right now. We will keep checking automatically.',
  };
}

export function canManageVoiceChannel(channel, {
  currentUserId = null,
  myRankOrder = null,
} = {}) {
  return channel?.created_by === currentUserId || myRankOrder === 0;
}

export function buildVoiceChannelRowState(channel, {
  activeChannelId = null,
  currentUserId = null,
  myRankOrder = null,
  participantStateOptions = {},
} = {}) {
  const participants = channel?.participants || [];

  return {
    isActive: activeChannelId === channel?.id,
    participantCount: participants.length,
    hasActiveStream: hasActiveVoiceStream(participants, participantStateOptions),
    canDeleteChannel: canManageVoiceChannel(channel, {
      currentUserId,
      myRankOrder,
    }),
  };
}

export function buildVoiceParticipantRowState(participant, {
  onlineUsersById = new Map(),
  participantStateOptions = {},
} = {}) {
  return {
    participant,
    profilePicture: onlineUsersById.get(participant?.userId)?.profilePicture || null,
    state: buildParticipantVoiceState(participant, participantStateOptions),
  };
}

export function buildVoiceVolumeMenuState(volumeMenu, {
  mutedUsers = {},
  getUserVolume = () => 100,
} = {}) {
  const userId = volumeMenu?.userId;
  const isMuted = Boolean(userId && mutedUsers[userId]);
  const displayVolume = userId ? (isMuted ? 0 : getUserVolume(userId)) : 0;

  return {
    displayVolume,
    isMuted,
    toggleLabel: isMuted ? 'Unmute' : 'Mute',
  };
}

export function findActiveVoiceStreamParticipant(participants = [], options = {}) {
  return participants.find((participant) => buildParticipantVoiceState(participant, options).screenSharing) || null;
}

export function hasActiveVoiceStream(participants = [], options = {}) {
  return Boolean(findActiveVoiceStreamParticipant(participants, options));
}

export function toggleMutedUserPreference(userId, {
  mutedUsers = {},
  volumes = {},
  storage = globalThis.localStorage,
} = {}) {
  const muted = !mutedUsers[userId];
  const nextMutedUsers = { ...mutedUsers, [userId]: muted };
  const nextVolumeRatio = muted
    ? 0
    : getStoredUserVolumePercent(userId, { volumes, storage }) / 100;

  return {
    muted,
    nextMutedUsers,
    nextVolumeRatio,
  };
}

export function unmuteUserForVolumeAdjustment(userId, mutedUsers = {}) {
  if (!mutedUsers[userId]) {
    return mutedUsers;
  }
  return {
    ...mutedUsers,
    [userId]: false,
  };
}
