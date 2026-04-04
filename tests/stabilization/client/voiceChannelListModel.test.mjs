import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceChannelRowState,
  buildOnlineUsersById,
  buildVoiceParticipantRowState,
  buildVoiceVolumeMenuState,
  buildParticipantVoiceState,
  buildProactiveVoiceNotice,
  buildVoiceRecoveryHint,
  canManageVoiceChannel,
  findActiveVoiceStreamParticipant,
  getStoredUserVolumePercent,
  hasActiveVoiceStream,
  parseMutedUsers,
  toggleMutedUserPreference,
  unmuteUserForVolumeAdjustment,
} from '../../../client/src/features/voice/voiceChannelListModel.mjs';

test('voice channel list model parses muted user preferences safely', () => {
  assert.deepEqual(parseMutedUsers('{"user-1":true}'), { 'user-1': true });
  assert.deepEqual(parseMutedUsers('not-json'), {});
  assert.deepEqual(parseMutedUsers('null'), {});
});

test('voice channel list model builds online-user maps and stored volume fallbacks consistently', () => {
  const onlineUsersById = buildOnlineUsersById([
    { userId: 'user-1', username: 'alpha' },
    { userId: 'user-2', username: 'beta' },
  ]);

  const storage = {
    getItem(key) {
      if (key === 'voice:userVolume:user-3') {
        return '0.42';
      }
      return null;
    },
  };

  assert.equal(onlineUsersById.get('user-2').username, 'beta');
  assert.equal(getStoredUserVolumePercent('user-1', { volumes: { 'user-1': 75 }, storage }), 75);
  assert.equal(getStoredUserVolumePercent('user-3', { volumes: {}, storage }), 42);
  assert.equal(getStoredUserVolumePercent('user-4', { volumes: {}, storage }), 100);
});

test('voice channel list model builds stable row, participant, and volume menu state', () => {
  const onlineUsersById = buildOnlineUsersById([
    { userId: 'user-2', profilePicture: 'https://cdn.example/avatar.png' },
  ]);
  const participantStateOptions = {
    currentUserId: 'user-1',
    activeChannelId: 'channel-1',
    channelId: 'channel-1',
    selfSpeaking: false,
    peers: {
      'user-2': { speaking: true, muted: false, deafened: false, screenSharing: true },
    },
  };

  assert.deepEqual(buildVoiceChannelRowState({
    id: 'channel-1',
    created_by: 'user-2',
    participants: [{ userId: 'user-2', username: 'beta' }],
  }, {
    activeChannelId: 'channel-1',
    currentUserId: 'user-1',
    myRankOrder: 0,
    participantStateOptions,
  }), {
    isActive: true,
    participantCount: 1,
    hasActiveStream: true,
    canDeleteChannel: true,
  });

  assert.deepEqual(buildVoiceParticipantRowState({
    userId: 'user-2',
    username: 'beta',
    avatarColor: '#fff',
  }, {
    onlineUsersById,
    participantStateOptions,
  }), {
    participant: {
      userId: 'user-2',
      username: 'beta',
      avatarColor: '#fff',
    },
    profilePicture: 'https://cdn.example/avatar.png',
    state: {
      speaking: true,
      muted: false,
      deafened: false,
      screenSharing: true,
    },
  });

  assert.deepEqual(buildVoiceVolumeMenuState({ userId: 'user-2' }, {
    mutedUsers: { 'user-2': true },
    getUserVolume: () => 55,
  }), {
    displayVolume: 0,
    isMuted: true,
    toggleLabel: 'Unmute',
  });
});

test('voice channel list model derives participant voice state and active streams consistently', () => {
  const participants = [
    { userId: 'user-1', muted: false, deafened: false },
    { userId: 'user-2', muted: true, deafened: false, screenSharing: false },
    { userId: 'user-3', muted: false, deafened: true, screenSharing: true },
  ];
  const options = {
    currentUserId: 'user-1',
    activeChannelId: 'channel-1',
    channelId: 'channel-1',
    selfSpeaking: true,
    peers: {
      'user-2': { speaking: true, muted: false, screenSharing: false },
      'user-3': { speaking: false, deafened: true, screenSharing: true },
    },
  };

  assert.deepEqual(buildParticipantVoiceState(participants[0], options), {
    speaking: true,
    muted: false,
    deafened: false,
    screenSharing: false,
  });
  assert.deepEqual(buildParticipantVoiceState(participants[1], options), {
    speaking: true,
    muted: false,
    deafened: false,
    screenSharing: false,
  });
  assert.equal(hasActiveVoiceStream(participants, options), true);
  assert.equal(findActiveVoiceStreamParticipant(participants, options).userId, 'user-3');
});

test('voice channel list model derives recovery hints and proactive notices only for degraded states', () => {
  assert.equal(buildVoiceRecoveryHint('Voice is temporarily unavailable right now.'), 'Voice workers are recovering. Wait a moment, then try joining again.');
  assert.equal(buildVoiceRecoveryHint('Other error'), null);

  assert.deepEqual(buildProactiveVoiceNotice({
    status: 'recovering',
    workerCount: 1,
    targetWorkerCount: 2,
  }), {
    tone: 'warning',
    title: 'Voice is recovering',
    detail: 'Workers online: 1/2. Joining may fail briefly while recovery finishes.',
  });

  assert.deepEqual(buildProactiveVoiceNotice({
    status: 'offline',
  }), {
    tone: 'danger',
    title: 'Voice is temporarily unavailable',
    detail: 'The server voice stack is offline right now. We will keep checking automatically.',
  });

  assert.equal(buildProactiveVoiceNotice({ status: 'ok' }), null);
});

test('voice channel list model keeps management and mute toggle decisions stable', () => {
  assert.equal(canManageVoiceChannel({ created_by: 'user-1' }, { currentUserId: 'user-1', myRankOrder: 2 }), true);
  assert.equal(canManageVoiceChannel({ created_by: 'user-2' }, { currentUserId: 'user-1', myRankOrder: 0 }), true);
  assert.equal(canManageVoiceChannel({ created_by: 'user-2' }, { currentUserId: 'user-1', myRankOrder: 2 }), false);

  const storage = {
    getItem(key) {
      if (key === 'voice:userVolume:user-2') return '0.6';
      return null;
    },
  };

  assert.deepEqual(toggleMutedUserPreference('user-1', {
    mutedUsers: {},
    volumes: { 'user-1': 80 },
    storage,
  }), {
    muted: true,
    nextMutedUsers: { 'user-1': true },
    nextVolumeRatio: 0,
  });

  assert.deepEqual(toggleMutedUserPreference('user-2', {
    mutedUsers: { 'user-2': true },
    volumes: {},
    storage,
  }), {
    muted: false,
    nextMutedUsers: { 'user-2': false },
    nextVolumeRatio: 0.6,
  });

  assert.deepEqual(unmuteUserForVolumeAdjustment('user-3', { 'user-3': true }), { 'user-3': false });
  assert.deepEqual(unmuteUserForVolumeAdjustment('user-4', { 'user-3': true }), { 'user-3': true });
});
