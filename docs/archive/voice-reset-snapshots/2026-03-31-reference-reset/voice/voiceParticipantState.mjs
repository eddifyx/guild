function normalizeVoiceParticipantUserId(userId) {
  if (userId === null || userId === undefined) return null;
  const normalized = String(userId).trim();
  return normalized || null;
}

export function normalizeVoiceParticipants(participants) {
  return Array.isArray(participants)
    ? participants
      .map((participant) => {
        const userId = normalizeVoiceParticipantUserId(participant?.userId);
        if (!userId) return null;
        return {
          ...participant,
          userId,
        };
      })
      .filter(Boolean)
    : [];
}

export function getVoiceParticipantIds(participants) {
  return Array.from(new Set(
    normalizeVoiceParticipants(participants).map((participant) => participant.userId)
  ));
}

export function buildVoicePeers(participants, {
  currentUserId = null,
} = {}) {
  const nextPeers = {};
  const normalizedCurrentUserId = normalizeVoiceParticipantUserId(currentUserId);

  for (const participant of normalizeVoiceParticipants(participants)) {
    if (participant.userId === normalizedCurrentUserId) continue;
    nextPeers[participant.userId] = {
      muted: !!participant.muted,
      deafened: !!participant.deafened,
      speaking: !!participant.speaking,
      screenSharing: !!participant.screenSharing,
    };
  }

  return nextPeers;
}

export function applyVoicePeerMuteUpdate(previousPeers = {}, {
  userId = null,
  muted = false,
  deafened = false,
} = {}) {
  const normalizedUserId = normalizeVoiceParticipantUserId(userId);
  if (!normalizedUserId) return previousPeers;
  return {
    ...previousPeers,
    [normalizedUserId]: {
      ...previousPeers[normalizedUserId],
      muted: !!muted,
      deafened: !!deafened,
    },
  };
}

export function applyVoicePeerSpeakingUpdate(previousPeers = {}, {
  userId = null,
  speaking = false,
} = {}) {
  const normalizedUserId = normalizeVoiceParticipantUserId(userId);
  if (!normalizedUserId) return previousPeers;
  return {
    ...previousPeers,
    [normalizedUserId]: {
      ...previousPeers[normalizedUserId],
      speaking: !!speaking,
    },
  };
}

export function buildVoiceParticipantSyncPlan(participants, {
  currentUserId = null,
  previousParticipantIds = [],
} = {}) {
  const normalizedParticipants = normalizeVoiceParticipants(participants);
  const participantIds = getVoiceParticipantIds(normalizedParticipants);
  const normalizedCurrentUserId = normalizeVoiceParticipantUserId(currentUserId);
  const currentUserPresent = !!normalizedCurrentUserId && participantIds.includes(normalizedCurrentUserId);
  const otherParticipantIds = participantIds.filter((id) => id !== normalizedCurrentUserId);
  const previousOtherParticipantIds = Array.isArray(previousParticipantIds)
    ? previousParticipantIds
      .map((id) => normalizeVoiceParticipantUserId(id))
      .filter((id) => id && id !== normalizedCurrentUserId)
    : [];
  const addedParticipantIds = otherParticipantIds.filter((id) => !previousOtherParticipantIds.includes(id));
  const removedParticipantIds = previousOtherParticipantIds.filter((id) => !otherParticipantIds.includes(id));

  return {
    normalizedParticipants,
    participantIds,
    currentUserPresent,
    peers: buildVoicePeers(normalizedParticipants, { currentUserId }),
    otherParticipantIds,
    previousOtherParticipantIds,
    addedParticipantIds,
    removedParticipantIds,
    membershipChanged:
      addedParticipantIds.length > 0
      || removedParticipantIds.length > 0
      || previousParticipantIds.length === 0,
    leaderId: [...participantIds].sort()[0] || null,
  };
}
