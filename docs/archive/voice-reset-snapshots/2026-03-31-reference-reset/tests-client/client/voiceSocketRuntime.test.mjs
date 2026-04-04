import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceEmitAsync,
  createVoiceSocketRuntimeHandlers,
  registerVoiceSocketRuntimeSubscriptions,
  VOICE_DISCONNECTED_ERROR_MESSAGE,
  VOICE_SESSION_ENDED_ERROR_MESSAGE,
  VOICE_SOCKET_EVENT_NAMES,
} from '../../../client/src/features/voice/voiceSocketRuntime.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('createVoiceEmitAsync resolves successful socket acknowledgements and clears disconnect listeners', async () => {
  const calls = [];
  const disconnectHandlers = [];
  const socket = {
    on(eventName, handler) {
      calls.push(['on', eventName]);
      if (eventName === VOICE_SOCKET_EVENT_NAMES.disconnect) {
        disconnectHandlers.push(handler);
      }
    },
    off(eventName, handler) {
      calls.push(['off', eventName]);
      if (eventName === VOICE_SOCKET_EVENT_NAMES.disconnect) {
        const index = disconnectHandlers.indexOf(handler);
        if (index >= 0) disconnectHandlers.splice(index, 1);
      }
    },
    emit(eventName, payload, ack) {
      calls.push(['emit', eventName, payload]);
      ack?.({ ok: true, channelId: 'voice-1' });
    },
  };

  const emitAsync = createVoiceEmitAsync({
    socket,
    setTimeoutFn: () => 'timeout-1',
    clearTimeoutFn: () => {},
  });

  const result = await emitAsync('voice:join', { channelId: 'voice-1' });

  assert.deepEqual(result, { ok: true, channelId: 'voice-1' });
  assert.equal(disconnectHandlers.length, 0);
  assert.deepEqual(calls.slice(0, 3), [
    ['on', VOICE_SOCKET_EVENT_NAMES.disconnect],
    ['emit', 'voice:join', { channelId: 'voice-1' }],
    ['off', VOICE_SOCKET_EVENT_NAMES.disconnect],
  ]);
});

test('createVoiceEmitAsync rejects when the socket disconnects before the ack arrives', async () => {
  let disconnectHandler = null;
  const socket = {
    on(eventName, handler) {
      if (eventName === VOICE_SOCKET_EVENT_NAMES.disconnect) {
        disconnectHandler = handler;
      }
    },
    off() {},
    emit() {},
  };

  const emitAsync = createVoiceEmitAsync({
    socket,
    setTimeoutFn: () => 'timeout-2',
    clearTimeoutFn: () => {},
  });

  const promise = emitAsync('voice:consume', { producerId: 'producer-1' });
  disconnectHandler();

  await assert.rejects(promise, /Voice connection lost/);
});

test('voice socket runtime channel updates handle ended sessions, untrusted peers, and trusted sync', async () => {
  const rememberCalls = [];
  const unexpectedEnds = [];
  const joinErrors = createStateContainer(null);
  const e2eWarnings = createStateContainer(null);
  const syncedParticipants = [];
  const syncedE2E = [];
  let leaveCount = 0;

  const handlers = createVoiceSocketRuntimeHandlers({
    currentUserId: 'user-1',
    getCurrentChannelId: () => 'channel-1',
    rememberUsers: (participants) => rememberCalls.push(participants),
    getUntrustedVoiceParticipants: (participants) => participants.filter((participant) => participant.untrusted),
    buildVoiceTrustError: () => 'waiting for trust',
    setJoinError: (nextValue) => joinErrors.set(nextValue),
    setE2EWarning: (nextValue) => e2eWarnings.set(nextValue),
    leaveChannel: async () => { leaveCount += 1; },
    syncVoiceParticipants: async (participants, options) => {
      syncedParticipants.push([participants, options]);
    },
    syncVoiceE2EState: async (participantIds, options) => {
      syncedE2E.push([participantIds, options]);
    },
    handleUnexpectedVoiceSessionEnd: async (...args) => unexpectedEnds.push(args),
  });

  handlers.handleChannelUpdate({
    channelId: 'channel-1',
    participants: [{ userId: 'user-2', username: 'Scout' }],
  });

  handlers.handleChannelUpdate({
    channelId: 'channel-1',
    participants: [
      { userId: 'user-1', username: 'Builder' },
      { userId: 'user-2', username: 'Scout', untrusted: true },
    ],
  });

  handlers.handleChannelUpdate({
    channelId: 'channel-1',
    participants: [
      { userId: 'user-1', username: 'Builder' },
      { userId: 'user-2', username: 'Scout' },
    ],
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(unexpectedEnds, [[VOICE_SESSION_ENDED_ERROR_MESSAGE, { channelId: 'channel-1' }]]);
  assert.equal(joinErrors.value, 'waiting for trust');
  assert.equal(e2eWarnings.value, 'waiting for trust');
  assert.equal(leaveCount, 1);
  assert.equal(rememberCalls.length, 3);
  assert.deepEqual(syncedParticipants, [[[
    { userId: 'user-1', username: 'Builder' },
    { userId: 'user-2', username: 'Scout' },
  ], { channelId: 'channel-1' }]]);
  assert.deepEqual(syncedE2E, [[['user-1', 'user-2'], {
    activeChannelId: 'channel-1',
    feature: 'Voice chat',
  }]]);
});

test('voice socket runtime producer, peer, delete, and key-update handlers keep runtime state consistent', async () => {
  const joinErrors = createStateContainer(null);
  const e2eWarnings = createStateContainer('stale warning');
  const voiceE2E = createStateContainer(false);
  const peers = createStateContainer({});
  const cleanupCalls = [];
  const resetCalls = [];
  const diagnostics = [];
  const lateKeyRecoveryCalls = [];
  const producerEntries = [
    ['producer-a', 'user-2'],
    ['producer-b', 'user-3'],
    ['producer-c', 'user-2'],
  ];
  const timeoutCallbacks = [];

  const handlers = createVoiceSocketRuntimeHandlers({
    getCurrentChannelId: () => 'channel-9',
    setJoinError: (nextValue) => joinErrors.set(nextValue),
    setVoiceE2E: (nextValue) => voiceE2E.set(nextValue),
    setE2EWarning: (nextValue) => e2eWarnings.set(nextValue),
    cleanupRemoteProducer: (...args) => cleanupCalls.push(args),
    consumeProducer: async () => {
      throw new Error('consumer setup failed');
    },
    setPeers: (updater) => peers.set(updater),
    resetVoiceSession: async (payload) => resetCalls.push(payload),
    getParticipantIds: () => ['user-1', 'user-2'],
    updateVoiceDiagnostics: (updater) => diagnostics.push(typeof updater === 'function' ? updater({ session: {} }) : updater),
    resumeVoiceMediaAfterKeyUpdate: async (payload) => lateKeyRecoveryCalls.push(payload),
    setTimeoutFn: (fn) => {
      timeoutCallbacks.push(fn);
      return `timeout-${timeoutCallbacks.length}`;
    },
  });

  await handlers.handleNewProducer({
    producerId: 'producer-x',
    producerUserId: 'user-2',
    source: 'microphone',
  });
  handlers.handleProducerClosed({
    producerUserId: 'user-2',
    source: 'microphone',
    getProducerUserEntries: () => producerEntries,
  });
  handlers.handlePeerMute({ userId: 'user-2', muted: true, deafened: false });
  handlers.handlePeerSpeaking({ userId: 'user-2', speaking: true });
  await handlers.handleChannelDeleted({ channelId: 'channel-9' });
  const updated = handlers.handleVoiceKeyUpdated({ detail: { channelId: 'channel-9' } });

  assert.equal(updated, true);
  assert.equal(joinErrors.value, 'This voice channel was deleted.');
  timeoutCallbacks[0]();
  assert.equal(joinErrors.value, 'This voice channel was deleted.');
  timeoutCallbacks[1]();
  assert.equal(joinErrors.value, null);
  assert.equal(voiceE2E.value, true);
  assert.equal(e2eWarnings.value, null);
  assert.deepEqual(cleanupCalls, [
    ['producer-x', { producerUserId: 'user-2', source: 'microphone' }],
    ['producer-a', { producerUserId: 'user-2', source: 'microphone' }],
    ['producer-c', { producerUserId: 'user-2', source: 'microphone' }],
  ]);
  assert.deepEqual(peers.value, {
    'user-2': { muted: true, deafened: false, speaking: true },
  });
  assert.deepEqual(resetCalls, [{ channelId: 'channel-9', notifyServer: false }]);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].session.secureVoice.state, 'ready');
  await Promise.resolve();
  assert.deepEqual(lateKeyRecoveryCalls, [{ channelId: 'channel-9' }]);
});

test('voice socket runtime subscriptions bind and unbind the canonical socket events', () => {
  const calls = [];
  const socket = {
    on(eventName) {
      calls.push(['on', eventName]);
    },
    off(eventName) {
      calls.push(['off', eventName]);
    },
  };

  const unsubscribe = registerVoiceSocketRuntimeSubscriptions(socket, {
    handleDisconnect() {},
    handleChannelUpdate() {},
    handleNewProducer() {},
    handleProducerClosed() {},
    handlePeerMute() {},
    handlePeerSpeaking() {},
    handleChannelDeleted() {},
  });
  unsubscribe();

  assert.deepEqual(
    calls.map(([method, eventName]) => [method, eventName]),
    [
      ['on', VOICE_SOCKET_EVENT_NAMES.disconnect],
      ['on', VOICE_SOCKET_EVENT_NAMES.channelUpdate],
      ['on', VOICE_SOCKET_EVENT_NAMES.newProducer],
      ['on', VOICE_SOCKET_EVENT_NAMES.producerClosed],
      ['on', VOICE_SOCKET_EVENT_NAMES.peerMuteUpdate],
      ['on', VOICE_SOCKET_EVENT_NAMES.speaking],
      ['on', VOICE_SOCKET_EVENT_NAMES.channelDeleted],
      ['off', VOICE_SOCKET_EVENT_NAMES.disconnect],
      ['off', VOICE_SOCKET_EVENT_NAMES.channelUpdate],
      ['off', VOICE_SOCKET_EVENT_NAMES.newProducer],
      ['off', VOICE_SOCKET_EVENT_NAMES.producerClosed],
      ['off', VOICE_SOCKET_EVENT_NAMES.peerMuteUpdate],
      ['off', VOICE_SOCKET_EVENT_NAMES.speaking],
      ['off', VOICE_SOCKET_EVENT_NAMES.channelDeleted],
    ]
  );
});

test('voice socket disconnect handler uses the shared disconnected message', async () => {
  const unexpectedEnds = [];
  const handlers = createVoiceSocketRuntimeHandlers({
    handleUnexpectedVoiceSessionEnd: async (...args) => unexpectedEnds.push(args),
  });

  handlers.handleDisconnect();
  await Promise.resolve();

  assert.deepEqual(unexpectedEnds, [[VOICE_DISCONNECTED_ERROR_MESSAGE]]);
});
