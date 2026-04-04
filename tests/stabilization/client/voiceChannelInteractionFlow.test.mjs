import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceChannelInteractionHandlers,
  syncVoiceChannelInteractionState,
} from '../../../client/src/features/voice/voiceChannelInteractionFlow.mjs';

test('voice channel interaction flow clears a stale volume menu when the user leaves all channels', () => {
  const updates = [];

  syncVoiceChannelInteractionState({
    voiceChannels: [
      {
        id: 'vc-1',
        participants: [{ userId: 'user-a' }],
      },
    ],
    volumeMenu: { userId: 'user-missing', username: 'Gone' },
    setVolumeMenuFn: (value) => updates.push(value),
  });

  assert.deepEqual(updates, [null]);
});

test('voice channel interaction handlers join inactive channels and route active selections', () => {
  const calls = [];
  const handlers = createVoiceChannelInteractionHandlers({
    joinChannelFn: (channelId) => calls.push(['join', channelId]),
    onSelectStreamFn: (userId, username) => calls.push(['stream', userId, username]),
    onSelectVoiceChannelFn: (channelId, channelName) => calls.push(['channel', channelId, channelName]),
  });

  handlers.handleChannelActivate({
    channel: { id: 'vc-1', name: 'War Room' },
    isActive: false,
  });

  handlers.handleChannelActivate({
    channel: { id: 'vc-2', name: 'Tavern Voice' },
    isActive: true,
    participants: [{ userId: 'user-b', username: 'B', screenSharing: true }],
    participantStateOptions: {
      currentUserId: 'user-a',
      activeChannelId: 'vc-2',
      channelId: 'vc-2',
      selfSpeaking: false,
      peers: {},
    },
  });

  handlers.handleChannelActivate({
    channel: { id: 'vc-3', name: 'Quiet Room' },
    isActive: true,
    participants: [{ userId: 'user-c', username: 'C', screenSharing: false }],
    participantStateOptions: {
      currentUserId: 'user-a',
      activeChannelId: 'vc-3',
      channelId: 'vc-3',
      selfSpeaking: false,
      peers: {},
    },
  });

  assert.deepEqual(calls, [
    ['join', 'vc-1'],
    ['stream', 'user-b', 'B'],
    ['channel', 'vc-3', 'Quiet Room'],
  ]);
});

test('voice channel interaction handlers manage participant volume menus and mute state', () => {
  const updates = [];
  let mutedUsers = { 'user-b': true };
  let volumes = {};
  const storage = {
    store: new Map([['voice:userVolume:user-b', '0.42']]),
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    setItem(key, value) {
      this.store.set(key, value);
      updates.push(['storage', key, value]);
    },
  };

  const handlers = createVoiceChannelInteractionHandlers({
    setVolumeMenuFn: (value) => updates.push(['menu', value]),
    setVolumesFn: (updater) => {
      volumes = typeof updater === 'function' ? updater(volumes) : updater;
      updates.push(['volumes', volumes]);
    },
    setMutedUsersFn: (updater) => {
      mutedUsers = typeof updater === 'function' ? updater(mutedUsers) : updater;
      updates.push(['mutedUsers', mutedUsers]);
    },
    setUserVolumeFn: (userId, volume) => updates.push(['userVolume', userId, volume]),
    mutedUsers,
    volumes,
    storage,
  });

  const event = {
    prevented: false,
    clientX: 12,
    clientY: 24,
    preventDefault() {
      this.prevented = true;
    },
  };

  handlers.openParticipantVolumeMenu(event, { userId: 'user-b', username: 'B' }, 'user-a');
  handlers.openParticipantVolumeMenu(event, { userId: 'user-a', username: 'A' }, 'user-a');
  assert.equal(event.prevented, true);
  assert.equal(handlers.getUserVolume('user-b'), 42);

  handlers.handleVolumeMenuChange('user-b', '75');
  handlers.toggleUserMute('user-b');
  handlers.closeVolumeMenu();

  assert.deepEqual(updates, [
    ['menu', { x: 12, y: 24, userId: 'user-b', username: 'B' }],
    ['storage', 'voice:mutedUsers', '{"user-b":false}'],
    ['mutedUsers', { 'user-b': false }],
    ['volumes', { 'user-b': 75 }],
    ['userVolume', 'user-b', 0.75],
    ['storage', 'voice:mutedUsers', '{"user-b":true}'],
    ['userVolume', 'user-b', 0],
    ['mutedUsers', { 'user-b': true }],
    ['menu', null],
  ]);
});
