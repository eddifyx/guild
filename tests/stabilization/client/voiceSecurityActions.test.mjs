import test from 'node:test';
import assert from 'node:assert/strict';

import { createVoiceSecurityActions } from '../../../client/src/features/voice/voiceSecurityActions.mjs';

test('voice security actions gate secure media readiness with safe-mode and capability checks', () => {
  const actions = createVoiceSecurityActions({
    constants: {
      voiceSafeMode: true,
    },
    runtime: {
      isE2EInitializedFn: () => false,
      isInsertableStreamsSupportedFn: () => false,
    },
  });

  assert.doesNotThrow(() => {
    actions.ensureSecureMediaReady('Voice chat');
  });

  assert.throws(() => {
    actions.ensureSecureMediaReady('Screen share');
  }, /end-to-end encryption is ready/);

  const insertableActions = createVoiceSecurityActions({
    constants: {
      voiceSafeMode: false,
    },
    runtime: {
      isE2EInitializedFn: () => true,
      isInsertableStreamsSupportedFn: () => false,
    },
  });

  assert.throws(() => {
    insertableActions.ensureSecureMediaReady('Voice chat');
  }, /secure media transforms/);
});

test('voice security actions delegate key recovery and E2E sync with stable lane inputs', async () => {
  const calls = [];
  const refs = {
    channelIdRef: { current: 'channel-1' },
    participantIdsRef: { current: ['user-1', 'user-2'] },
  };

  const actions = createVoiceSecurityActions({
    refs,
    setters: {
      setVoiceE2EFn: (value) => calls.push(['setVoiceE2E', value]),
      setE2EWarningFn: (value) => calls.push(['setE2EWarning', value]),
      setJoinErrorFn: (value) => calls.push(['setJoinError', value]),
    },
    runtime: {
      socket: { id: 'socket-1' },
      getVoiceAudioBypassModeFn: () => 'bypass',
      getVoiceKeyFn: () => 'voice-key',
      waitForVoiceKeyFn: async () => 'voice-key',
      generateVoiceKeyFn: async () => 'generated-key',
      setVoiceKeyFn: () => calls.push(['setVoiceKey']),
      distributeVoiceKeyFn: async () => calls.push(['distributeVoiceKey']),
      updateVoiceDiagnosticsFn: (updater) => calls.push(['updateVoiceDiagnostics', typeof updater]),
    },
    currentUserId: 'user-1',
    constants: {
      voiceSafeMode: true,
    },
    deps: {
      recoverVoiceKeyForParticipantsFn: async (participantIds, options) => {
        calls.push(['recover', participantIds, options]);
        return 'recovered';
      },
      ensureVoiceKeyForParticipantsFn: async (participantIds, options) => {
        calls.push(['ensure', participantIds, options]);
        return 'ensured';
      },
      syncVoiceE2EStateFn: async (participantIds, options) => {
        calls.push(['syncE2E', participantIds, options]);
        return 'synced';
      },
    },
  });

  await actions.recoverVoiceKeyForParticipants(['user-2']);
  await actions.ensureVoiceKeyForParticipants(['user-2', 'user-3'], {
    feature: 'Screen share',
  });
  await actions.syncVoiceE2EState(['user-2', 'user-3'], {
    feature: 'Screen share',
  });

  assert.equal(calls[0][0], 'recover');
  assert.deepEqual(calls[0][1], ['user-2']);
  assert.equal(calls[0][2].activeChannelId, 'channel-1');
  assert.equal(calls[0][2].currentUserId, 'user-1');

  assert.equal(calls[1][0], 'ensure');
  assert.deepEqual(calls[1][1], ['user-2', 'user-3']);
  assert.equal(calls[1][2].feature, 'Screen share');
  assert.deepEqual(calls[1][2].currentParticipantIds, ['user-1', 'user-2']);

  assert.equal(calls[2][0], 'syncE2E');
  assert.deepEqual(calls[2][1], ['user-2', 'user-3']);
  assert.equal(calls[2][2].voiceSafeMode, true);
  assert.equal(typeof calls[2][2].ensureVoiceKeyForParticipantsFn, 'function');
});

test('voice security actions keep trust and participant sync under one lane context', async () => {
  const participantIdsRef = { current: ['user-1'] };
  const calls = [];

  const actions = createVoiceSecurityActions({
    refs: {
      channelIdRef: { current: 'channel-4' },
      participantIdsRef,
    },
    setters: {
      setPeersFn: (value) => calls.push(['setPeers', value]),
    },
    runtime: {
      socket: { id: 'socket-4' },
      flushPendingControlMessagesNowFn: () => calls.push(['flushPending']),
      setVoiceChannelIdFn: (value) => calls.push(['setVoiceChannelId', value]),
      setVoiceChannelParticipantsFn: (value) => calls.push(['setVoiceChannelParticipants', value]),
      getVoiceKeyFn: () => 'voice-key',
      generateVoiceKeyFn: async () => 'generated-key',
      setVoiceKeyFn: (value) => calls.push(['setVoiceKey', value]),
      clearVoiceKeyFn: () => calls.push(['clearVoiceKey']),
      distributeVoiceKeyFn: async () => calls.push(['distributeVoiceKey']),
    },
    currentUserId: 'user-1',
    deps: {
      getUntrustedVoiceParticipantsFn: (participants, options) => {
        calls.push(['getUntrusted', participants, options]);
        return participants.filter((participant) => participant.userId !== options.currentUserId);
      },
      buildVoiceTrustErrorFn: (participants, options) => {
        calls.push(['buildTrustError', participants, options]);
        return `trust:${participants.length}:${options.currentUserId}`;
      },
      syncVoiceParticipantsRuntimeFn: async (participants, options) => {
        calls.push(['syncParticipants', participants, options]);
        options.setParticipantIdsFn(['user-1', 'user-2', 'user-3']);
      },
    },
  });

  const participants = [
    { userId: 'user-1' },
    { userId: 'user-2' },
    { userId: 'user-3' },
  ];

  const untrusted = actions.getUntrustedVoiceParticipants(participants);
  const trustError = actions.buildVoiceTrustError(participants);
  await actions.syncVoiceParticipants(participants);

  assert.deepEqual(untrusted, [
    { userId: 'user-2' },
    { userId: 'user-3' },
  ]);
  assert.equal(trustError, 'trust:3:user-1');
  assert.deepEqual(participantIdsRef.current, ['user-1', 'user-2', 'user-3']);
  assert.equal(calls.some((entry) => entry[0] === 'syncParticipants' && entry[2].activeChannelId === 'channel-4'), true);
});
