import {
  buildVoiceParticipantSyncPlan,
} from './voiceParticipantState.mjs';
import {
  synchronizeVoiceParticipantKeyState,
} from './voiceSecureFlow.mjs';

export async function syncVoiceParticipantsRuntime(participants, {
  activeChannelId = null,
  currentUserId = null,
  previousParticipantIds = [],
  socket = null,
  setParticipantIdsFn = () => {},
  setVoiceChannelIdFn = () => {},
  setVoiceChannelParticipantsFn = () => {},
  flushPendingControlMessagesNowFn = async () => {},
  setPeersFn = () => {},
  getVoiceKeyFn = () => null,
  generateVoiceKeyFn = () => ({}),
  setVoiceKeyFn = () => {},
  clearVoiceKeyFn = () => {},
  distributeVoiceKeyFn = async () => {},
} = {}) {
  const plan = buildVoiceParticipantSyncPlan(participants, {
    currentUserId,
    previousParticipantIds,
  });

  setParticipantIdsFn(plan.participantIds);
  if (activeChannelId) {
    setVoiceChannelIdFn(activeChannelId);
  }
  setVoiceChannelParticipantsFn(plan.participantIds);
  await flushPendingControlMessagesNowFn().catch(() => {});

  setPeersFn(() => plan.peers);

  if (!activeChannelId || !currentUserId || !plan.currentUserPresent || !socket) {
    return plan;
  }

  await synchronizeVoiceParticipantKeyState({
    currentUserPresent: plan.currentUserPresent,
    otherParticipantIds: plan.otherParticipantIds,
    previousOtherParticipantIds: plan.previousOtherParticipantIds,
    removedParticipantIds: plan.removedParticipantIds,
    membershipChanged: plan.membershipChanged,
    leaderId: plan.leaderId,
  }, {
    activeChannelId,
    currentUserId,
    socket,
    getVoiceKeyFn,
    generateVoiceKeyFn,
    setVoiceKeyFn,
    clearVoiceKeyFn,
    distributeVoiceKeyFn,
  });

  return plan;
}
