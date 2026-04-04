import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoicePeerMuteUpdate,
  applyVoicePeerSpeakingUpdate,
  buildVoiceParticipantSyncPlan,
  buildVoicePeers,
  getVoiceParticipantIds,
  normalizeVoiceParticipants,
} from '../../../client/src/features/voice/voiceParticipantState.mjs';

test('voice participant state normalizes participants and builds peer snapshots', () => {
  const participants = normalizeVoiceParticipants([
    null,
    { userId: 'user-1', muted: false },
    { userId: '', muted: true },
    { userId: 'user-2', muted: true, deafened: false, speaking: true, screenSharing: true },
    { userId: 'user-1', muted: true },
  ]);

  assert.deepEqual(participants, [
    { userId: 'user-1', muted: false },
    { userId: 'user-2', muted: true, deafened: false, speaking: true, screenSharing: true },
    { userId: 'user-1', muted: true },
  ]);
  assert.deepEqual(getVoiceParticipantIds(participants), ['user-1', 'user-2']);
  assert.deepEqual(buildVoicePeers(participants, { currentUserId: 'user-1' }), {
    'user-2': {
      muted: true,
      deafened: false,
      speaking: true,
      screenSharing: true,
    },
  });
});

test('voice participant state applies live mute and speaking deltas without losing peer fields', () => {
  const peers = {
    'user-2': {
      muted: false,
      deafened: false,
      speaking: false,
      screenSharing: true,
    },
  };

  const mutedPeers = applyVoicePeerMuteUpdate(peers, {
    userId: 'user-2',
    muted: true,
    deafened: true,
  });
  const speakingPeers = applyVoicePeerSpeakingUpdate(mutedPeers, {
    userId: 'user-2',
    speaking: true,
  });

  assert.deepEqual(speakingPeers, {
    'user-2': {
      muted: true,
      deafened: true,
      speaking: true,
      screenSharing: true,
    },
  });
});

test('voice participant sync plan captures membership and leader changes', () => {
  const plan = buildVoiceParticipantSyncPlan([
    { userId: 'user-1' },
    { userId: 'user-3', muted: true },
    { userId: 'user-2', speaking: true },
    { userId: 'user-3', muted: false },
  ], {
    currentUserId: 'user-2',
    previousParticipantIds: ['user-2', 'user-4'],
  });

  assert.deepEqual(plan.participantIds, ['user-1', 'user-3', 'user-2']);
  assert.equal(plan.currentUserPresent, true);
  assert.deepEqual(plan.otherParticipantIds, ['user-1', 'user-3']);
  assert.deepEqual(plan.addedParticipantIds, ['user-1', 'user-3']);
  assert.deepEqual(plan.removedParticipantIds, ['user-4']);
  assert.equal(plan.membershipChanged, true);
  assert.equal(plan.leaderId, 'user-1');
  assert.deepEqual(plan.peers, {
    'user-1': {
      muted: false,
      deafened: false,
      speaking: false,
      screenSharing: false,
    },
    'user-3': {
      muted: false,
      deafened: false,
      speaking: false,
      screenSharing: false,
    },
  });
});
