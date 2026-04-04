import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureVoiceKeyForParticipants,
  getVoiceKeyLeaders,
  recoverVoiceKeyForParticipants,
  synchronizeVoiceParticipantKeyState,
} from '../../../client/src/features/voice/voiceSecureFlow.mjs';

test('voice secure flow derives primary and recovery leaders from sorted participants', () => {
  assert.deepEqual(getVoiceKeyLeaders(['user-3', 'user-1', 'user-2', 'user-1']), {
    orderedParticipantIds: ['user-1', 'user-2', 'user-3'],
    primaryLeaderId: 'user-1',
    recoveryLeaderId: 'user-2',
  });
});

test('voice secure flow rotates keys during recovery based on leader role', async () => {
  const setCalls = [];
  const distributeCalls = [];
  const existingKey = { key: new Uint8Array([1, 2, 3]), epoch: 17 };

  const primaryResult = await recoverVoiceKeyForParticipants(['user-1', 'user-2'], {
    activeChannelId: 'channel-1',
    currentUserId: 'user-1',
    socket: {},
    getVoiceKeyFn: () => existingKey,
    waitForVoiceKeyFn: async () => { throw new Error('no key'); },
    generateVoiceKeyFn: ({ minEpoch }) => ({ key: new Uint8Array([9]), epoch: minEpoch }),
    setVoiceKeyFn: (...args) => setCalls.push(args),
    distributeVoiceKeyFn: async (...args) => {
      distributeCalls.push(args);
    },
    encodeVoiceKeyFn: () => 'encoded-rotated-primary',
  });

  assert.equal(primaryResult.epoch, 1024);
  assert.deepEqual(setCalls, [['encoded-rotated-primary', 1024]]);
  assert.deepEqual(distributeCalls, [[
    'channel-1',
    ['user-2'],
    primaryResult.key,
    1024,
    {},
  ]]);

  const rotatedCalls = [];
  const recoveryResult = await recoverVoiceKeyForParticipants(['user-1', 'user-2'], {
    activeChannelId: 'channel-1',
    currentUserId: 'user-2',
    socket: {},
    getVoiceKeyFn: () => null,
    waitForVoiceKeyFn: async () => { throw new Error('timeout'); },
    generateVoiceKeyFn: ({ minEpoch }) => ({ key: new Uint8Array([7, 8]), epoch: minEpoch }),
    setVoiceKeyFn: (...args) => rotatedCalls.push(['set', ...args]),
    distributeVoiceKeyFn: async (...args) => rotatedCalls.push(['distribute', ...args]),
    encodeVoiceKeyFn: () => 'encoded-rotated',
  });

  assert.equal(recoveryResult.epoch, 2048);
  assert.deepEqual(rotatedCalls, [
    ['set', 'encoded-rotated', 2048],
    ['distribute', 'channel-1', ['user-1'], recoveryResult.key, 2048, {}],
  ]);
});

test('voice secure flow escalates to recovery after wait timeout and respects current membership', async () => {
  const recoveryCalls = [];

  const result = await ensureVoiceKeyForParticipants(['user-1', 'user-2'], {
    activeChannelId: 'channel-9',
    currentUserId: 'user-1',
    currentParticipantIds: ['user-1', 'user-2'],
    currentChannelId: 'channel-9',
    getVoiceKeyFn: () => null,
    waitForVoiceKeyFn: async () => { throw new Error('timeout'); },
    recoverVoiceKeyForParticipantsFn: async (...args) => {
      recoveryCalls.push(args);
      return { key: new Uint8Array([4]), epoch: 33 };
    },
  });

  assert.equal(result.epoch, 33);
  assert.deepEqual(recoveryCalls, [[
    ['user-1', 'user-2'],
    { activeChannelId: 'channel-9', timeoutMs: 5000 },
  ]]);

  const idleResult = await ensureVoiceKeyForParticipants(['user-1'], {
    activeChannelId: 'channel-9',
    currentUserId: 'user-1',
    getVoiceKeyFn: () => ({ key: new Uint8Array([1]), epoch: 9 }),
  });
  assert.equal(idleResult.epoch, 9);
});

test('voice secure flow synchronizes participant key state for solo, rotation, and redistribution paths', async () => {
  const calls = [];

  const cleared = await synchronizeVoiceParticipantKeyState({
    currentUserPresent: true,
    otherParticipantIds: [],
    previousOtherParticipantIds: ['user-2'],
  }, {
    activeChannelId: 'channel-2',
    currentUserId: 'user-1',
    socket: {},
    getVoiceKeyFn: () => ({ key: new Uint8Array([1]), epoch: 4 }),
    generateVoiceKeyFn: () => ({ key: new Uint8Array([2]), epoch: 5 }),
    setVoiceKeyFn: () => {},
    clearVoiceKeyFn: (...args) => calls.push(['clear', ...args]),
    distributeVoiceKeyFn: async (...args) => calls.push(['distribute', ...args]),
  });
  assert.equal(cleared, null);
  assert.deepEqual(calls, [['clear', { preserveChannelState: true }]]);

  const rotatedCalls = [];
  const rotated = await synchronizeVoiceParticipantKeyState({
    currentUserPresent: true,
    otherParticipantIds: ['user-2'],
    previousOtherParticipantIds: ['user-2', 'user-3'],
    removedParticipantIds: ['user-3'],
    membershipChanged: true,
    leaderId: 'user-1',
  }, {
    activeChannelId: 'channel-2',
    currentUserId: 'user-1',
    socket: {},
    getVoiceKeyFn: () => ({ key: new Uint8Array([1]), epoch: 4 }),
    generateVoiceKeyFn: () => ({ key: new Uint8Array([5]), epoch: 6 }),
    setVoiceKeyFn: (...args) => rotatedCalls.push(['set', ...args]),
    clearVoiceKeyFn: () => {},
    distributeVoiceKeyFn: async (...args) => rotatedCalls.push(['distribute', ...args]),
    encodeVoiceKeyFn: () => 'encoded-6',
  });
  assert.equal(rotated.epoch, 6);
  assert.deepEqual(rotatedCalls, [
    ['set', 'encoded-6', 6],
    ['distribute', 'channel-2', ['user-2'], rotated.key, 6, {}],
  ]);

  const rotatedForMembershipCalls = [];
  const rotatedForMembership = await synchronizeVoiceParticipantKeyState({
    currentUserPresent: true,
    otherParticipantIds: ['user-2', 'user-4'],
    previousOtherParticipantIds: ['user-2'],
    removedParticipantIds: [],
    membershipChanged: true,
    leaderId: 'user-1',
  }, {
    activeChannelId: 'channel-2',
    currentUserId: 'user-1',
    socket: {},
    getVoiceKeyFn: () => ({ key: new Uint8Array([8]), epoch: 11 }),
    generateVoiceKeyFn: () => ({ key: new Uint8Array([9]), epoch: 12 }),
    setVoiceKeyFn: (...args) => rotatedForMembershipCalls.push(['set', ...args]),
    clearVoiceKeyFn: () => {},
    distributeVoiceKeyFn: async (...args) => rotatedForMembershipCalls.push(['distribute', ...args]),
    encodeVoiceKeyFn: () => 'encoded-12',
  });
  assert.equal(rotatedForMembership.epoch, 12);
  assert.deepEqual(rotatedForMembershipCalls, [
    ['set', 'encoded-12', 12],
    ['distribute', 'channel-2', ['user-2', 'user-4'], rotatedForMembership.key, 12, {}],
  ]);
});
