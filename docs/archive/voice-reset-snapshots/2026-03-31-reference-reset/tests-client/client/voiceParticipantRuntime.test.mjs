import test from 'node:test';
import assert from 'node:assert/strict';

import {
  syncVoiceParticipantsRuntime,
} from '../../../client/src/features/voice/voiceParticipantRuntime.mjs';

test('voice participant runtime syncs ids, peers, and secure redistribution for active sessions', async () => {
  const calls = [];
  let storedParticipantIds = null;
  let peersUpdater = null;

  const plan = await syncVoiceParticipantsRuntime([
    { userId: 'user-1' },
    { userId: 'user-3', muted: true },
    { userId: 'user-2', speaking: true },
  ], {
    activeChannelId: 'channel-1',
    currentUserId: 'user-1',
    previousParticipantIds: ['user-1', 'user-4'],
    socket: {},
    setParticipantIdsFn: (value) => {
      storedParticipantIds = value;
    },
    setVoiceChannelIdFn: (value) => calls.push(['channelId', value]),
    setVoiceChannelParticipantsFn: (value) => calls.push(['participants', value]),
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    setPeersFn: (updater) => {
      peersUpdater = updater;
    },
    getVoiceKeyFn: () => ({ key: new Uint8Array([8]), epoch: 11 }),
    generateVoiceKeyFn: () => ({ key: new Uint8Array([9]), epoch: 12 }),
    setVoiceKeyFn: () => calls.push(['set-key']),
    clearVoiceKeyFn: () => calls.push(['clear-key']),
    distributeVoiceKeyFn: async (...args) => calls.push(['distribute', ...args]),
  });

  assert.deepEqual(plan.participantIds, ['user-1', 'user-3', 'user-2']);
  assert.deepEqual(storedParticipantIds, ['user-1', 'user-3', 'user-2']);
  assert.deepEqual(peersUpdater({}), {
    'user-3': {
      muted: true,
      deafened: false,
      speaking: false,
      screenSharing: false,
    },
    'user-2': {
      muted: false,
      deafened: false,
      speaking: true,
      screenSharing: false,
    },
  });
  assert.deepEqual(calls, [
    ['channelId', 'channel-1'],
    ['participants', ['user-1', 'user-3', 'user-2']],
    ['flush'],
    ['set-key'],
    ['distribute', 'channel-1', ['user-3', 'user-2'], new Uint8Array([9]), 12, {}],
  ]);
});

test('voice participant runtime skips secure redistribution when the current user is absent or no channel is active', async () => {
  const calls = [];

  const plan = await syncVoiceParticipantsRuntime([
    { userId: 'user-1' },
    { userId: 'user-3', muted: true },
  ], {
    activeChannelId: null,
    currentUserId: 'user-2',
    previousParticipantIds: ['user-2'],
    socket: {},
    setParticipantIdsFn: (value) => calls.push(['participants-ref', value]),
    setVoiceChannelIdFn: () => calls.push(['channelId']),
    setVoiceChannelParticipantsFn: (value) => calls.push(['participants', value]),
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    setPeersFn: () => calls.push(['peers']),
    distributeVoiceKeyFn: async () => calls.push(['distribute']),
  });

  assert.equal(plan.currentUserPresent, false);
  assert.deepEqual(calls, [
    ['participants-ref', ['user-1', 'user-3']],
    ['participants', ['user-1', 'user-3']],
    ['flush'],
    ['peers'],
  ]);
});

test('voice participant runtime normalizes user identifiers before secure leader selection', async () => {
  const calls = [];
  let storedParticipantIds = null;

  const plan = await syncVoiceParticipantsRuntime([
    { userId: 7 },
    { userId: '9', speaking: true },
  ], {
    activeChannelId: 'channel-2',
    currentUserId: 7,
    previousParticipantIds: [],
    socket: {},
    setParticipantIdsFn: (value) => {
      storedParticipantIds = value;
    },
    setVoiceChannelIdFn: (value) => calls.push(['channelId', value]),
    setVoiceChannelParticipantsFn: (value) => calls.push(['participants', value]),
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    setPeersFn: () => calls.push(['peers']),
    getVoiceKeyFn: () => null,
    generateVoiceKeyFn: () => ({ key: new Uint8Array([4]), epoch: 3 }),
    setVoiceKeyFn: (...args) => calls.push(['set-key', ...args]),
    clearVoiceKeyFn: () => calls.push(['clear-key']),
    distributeVoiceKeyFn: async (...args) => calls.push(['distribute', ...args]),
  });

  assert.deepEqual(plan.participantIds, ['7', '9']);
  assert.deepEqual(storedParticipantIds, ['7', '9']);
  assert.deepEqual(calls, [
    ['channelId', 'channel-2'],
    ['participants', ['7', '9']],
    ['flush'],
    ['peers'],
    ['set-key', 'BA==', 3],
    ['distribute', 'channel-2', ['9'], new Uint8Array([4]), 3, {}],
  ]);
});
