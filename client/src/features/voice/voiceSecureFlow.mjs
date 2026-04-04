import { toBase64 } from '../../crypto/primitives.js';

function normalizeVoiceSecureId(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function getVoiceKeyLeaders(participantIds) {
  const orderedParticipantIds = Array.from(new Set(
    Array.isArray(participantIds)
      ? participantIds
        .map((participantId) => normalizeVoiceSecureId(participantId))
        .filter(Boolean)
      : []
  )).sort();

  return {
    orderedParticipantIds,
    primaryLeaderId: orderedParticipantIds[0] || null,
    recoveryLeaderId: orderedParticipantIds[1] || orderedParticipantIds[0] || null,
  };
}

export async function recoverVoiceKeyForParticipants(participantIds, {
  activeChannelId = null,
  timeoutMs = 5000,
  currentUserId = null,
  socket = null,
  getVoiceKeyFn = () => null,
  waitForVoiceKeyFn = async () => null,
  generateVoiceKeyFn,
  setVoiceKeyFn,
  distributeVoiceKeyFn,
  encodeVoiceKeyFn = toBase64,
} = {}) {
  const normalizedCurrentUserId = normalizeVoiceSecureId(currentUserId);
  const otherParticipantIds = Array.isArray(participantIds)
    ? participantIds
      .map((participantId) => normalizeVoiceSecureId(participantId))
      .filter((participantId) => participantId && participantId !== normalizedCurrentUserId)
    : [];

  if (!activeChannelId || !socket || !normalizedCurrentUserId || otherParticipantIds.length === 0) {
    throw new Error('Secure voice recovery requires another participant.');
  }

  const allParticipantIds = Array.from(new Set([normalizedCurrentUserId, ...otherParticipantIds]));
  const { primaryLeaderId, recoveryLeaderId } = getVoiceKeyLeaders(allParticipantIds);
  const existingVoiceKey = getVoiceKeyFn();

  if (normalizedCurrentUserId === primaryLeaderId) {
    const nextEpochFloor = Math.max(existingVoiceKey?.epoch || 0, 1023) + 1;
    const { key, epoch } = generateVoiceKeyFn({ minEpoch: nextEpochFloor });
    setVoiceKeyFn(encodeVoiceKeyFn(key), epoch);
    await distributeVoiceKeyFn(activeChannelId, otherParticipantIds, key, epoch, socket);
    return { key, epoch };
  }

  if (normalizedCurrentUserId === recoveryLeaderId) {
    try {
      return await waitForVoiceKeyFn(activeChannelId, Math.min(timeoutMs, 1500));
    } catch {}

    const latestVoiceKey = getVoiceKeyFn();
    if (latestVoiceKey) {
      return latestVoiceKey;
    }

    const nextEpochFloor = Math.max(existingVoiceKey?.epoch || 0, 2047) + 1;
    const { key, epoch } = generateVoiceKeyFn({ minEpoch: nextEpochFloor });
    setVoiceKeyFn(encodeVoiceKeyFn(key), epoch);
    await distributeVoiceKeyFn(activeChannelId, otherParticipantIds, key, epoch, socket);
    return { key, epoch };
  }

  return waitForVoiceKeyFn(activeChannelId, timeoutMs);
}

export async function ensureVoiceKeyForParticipants(participantIds, {
  activeChannelId = null,
  feature = 'Voice chat',
  timeoutMs = 5000,
  currentUserId = null,
  currentParticipantIds = [],
  currentChannelId = null,
  getVoiceKeyFn = () => null,
  waitForVoiceKeyFn = async () => null,
  recoverVoiceKeyForParticipantsFn = async () => null,
} = {}) {
  const normalizedCurrentUserId = normalizeVoiceSecureId(currentUserId);
  const otherParticipantIds = Array.isArray(participantIds)
    ? participantIds
      .map((participantId) => normalizeVoiceSecureId(participantId))
      .filter((participantId) => participantId && participantId !== normalizedCurrentUserId)
    : [];

  if (!activeChannelId || !normalizedCurrentUserId || otherParticipantIds.length === 0) {
    return getVoiceKeyFn();
  }

  const existingVoiceKey = getVoiceKeyFn();
  if (existingVoiceKey) {
    return existingVoiceKey;
  }

  try {
    return await waitForVoiceKeyFn(activeChannelId, timeoutMs);
  } catch {
    const currentOtherParticipants = Array.isArray(currentParticipantIds)
      ? currentParticipantIds
        .map((participantId) => normalizeVoiceSecureId(participantId))
        .filter((participantId) => participantId && participantId !== normalizedCurrentUserId)
      : [];
    if (currentChannelId !== activeChannelId || currentOtherParticipants.length === 0) {
      return getVoiceKeyFn();
    }
    const lateVoiceKey = getVoiceKeyFn();
    if (lateVoiceKey) {
      return lateVoiceKey;
    }
    try {
      return await recoverVoiceKeyForParticipantsFn(
        [normalizedCurrentUserId, ...currentOtherParticipants],
        { activeChannelId, timeoutMs }
      );
    } catch {}
    throw new Error(`${feature} is unavailable because the secure media key did not arrive in time.`);
  }
}

export async function synchronizeVoiceParticipantKeyState(participantSyncPlan, {
  activeChannelId = null,
  currentUserId = null,
  socket = null,
  getVoiceKeyFn = () => null,
  generateVoiceKeyFn,
  setVoiceKeyFn,
  clearVoiceKeyFn,
  distributeVoiceKeyFn,
  encodeVoiceKeyFn = toBase64,
} = {}) {
  const {
    currentUserPresent = false,
    otherParticipantIds = [],
    previousOtherParticipantIds = [],
    removedParticipantIds = [],
    membershipChanged = false,
    leaderId = null,
  } = participantSyncPlan || {};
  const normalizedCurrentUserId = normalizeVoiceSecureId(currentUserId);
  const normalizedOtherParticipantIds = Array.isArray(otherParticipantIds)
    ? otherParticipantIds
      .map((participantId) => normalizeVoiceSecureId(participantId))
      .filter(Boolean)
    : [];
  const normalizedPreviousOtherParticipantIds = Array.isArray(previousOtherParticipantIds)
    ? previousOtherParticipantIds
      .map((participantId) => normalizeVoiceSecureId(participantId))
      .filter(Boolean)
    : [];
  const normalizedRemovedParticipantIds = Array.isArray(removedParticipantIds)
    ? removedParticipantIds
      .map((participantId) => normalizeVoiceSecureId(participantId))
      .filter(Boolean)
    : [];
  const normalizedLeaderId = normalizeVoiceSecureId(leaderId);

  if (!activeChannelId || !normalizedCurrentUserId || !currentUserPresent || !socket) {
    return null;
  }

  if (normalizedOtherParticipantIds.length === 0) {
    if (normalizedPreviousOtherParticipantIds.length > 0) {
      clearVoiceKeyFn({ preserveChannelState: true });
    }
    return null;
  }

  let voiceKey = getVoiceKeyFn();

  const shouldRotateKey = (
    !voiceKey
    || normalizedRemovedParticipantIds.length > 0
    || membershipChanged === true
  );

  if (shouldRotateKey) {
    if (normalizedLeaderId !== normalizedCurrentUserId) {
      return voiceKey;
    }
    const { key, epoch } = generateVoiceKeyFn();
    setVoiceKeyFn(encodeVoiceKeyFn(key), epoch);
    voiceKey = { key, epoch };
    try {
      await distributeVoiceKeyFn(activeChannelId, normalizedOtherParticipantIds, key, epoch, socket);
    } catch {}
    return voiceKey;
  }

  return voiceKey;
}
