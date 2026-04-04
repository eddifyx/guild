const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VOICE_SERVICE_UNAVAILABLE_ERROR,
  createVoiceTransportFlow,
} = require('../../../server/src/domain/voice/voiceTransportFlow');

function createHarness(overrides = {}) {
  const metricEvents = [];
  const metricErrors = [];
  const socketEmits = [];
  const invalidPayloads = [];
  const cleanupCalls = [];

  const socket = {
    to(room) {
      return {
        emit(event, payload) {
          socketEmits.push([room, event, payload]);
        },
      };
    },
  };

  const io = {
    to() {
      return {
        emit() {},
      };
    },
  };

  const voiceRuntime = {
    hasLiveVoiceSession: () => true,
    getUserActiveVoiceChannelId: () => 'voice-old',
    cleanupUserVoiceSessions: async (...args) => {
      cleanupCalls.push(args);
    },
    markUserJoinedChannel: () => [{ userId: 'user-1', muted: false }],
  };

  const msManager = {
    getStatsSnapshot: () => ({ workerCount: 1, workersAvailable: true }),
    getOrCreateRoom: async () => ({ router: { rtpCapabilities: { codecs: ['opus'] } } }),
    getRoomPeers: () => ['user-1', 'user-2'],
    getProducersForPeer: (_channelId, peerId) => [`${peerId}:audio`],
    createWebRtcTransport: async () => ({ id: 'transport-1' }),
    connectTransport: async () => {},
    produce: async () => ({
      producerId: 'producer-1',
      kind: 'audio',
      source: 'microphone',
      producer: {
        on() {},
        observer: { on() {} },
      },
    }),
    consume: async () => ({ consumerId: 'consumer-1', kind: 'audio', paused: false }),
    resumeConsumer: async () => {},
  };

  const runtimeMetrics = {
    recordVoiceEvent: (event, payload) => metricEvents.push([event, payload]),
    recordVoiceError: (event, payload) => metricErrors.push([event, payload]),
    recordVoiceJoin: (payload) => metricEvents.push(['join', payload]),
    recordVoiceProduce: (payload) => metricEvents.push(['produce', payload]),
    recordVoiceConsume: (payload) => metricEvents.push(['consume', payload]),
  };

  const flow = createVoiceTransportFlow({
    io,
    socket,
    userId: 'user-1',
    voiceRuntime,
    msManager,
    runtimeMetrics,
    getVoiceChannelById: { get: () => ({ id: 'voice-1', guild_id: 'guild-1' }) },
    isGuildMember: { get: () => true },
    rejectInvalidVoicePayload: (...args) => invalidPayloads.push(args),
    validateVoiceJoinPayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceCreateTransportPayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceConnectTransportPayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceProducePayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceConsumePayload: (payload) => ({ ok: true, value: payload }),
    validateVoiceResumeConsumerPayload: (payload) => ({ ok: true, value: payload }),
    ...overrides,
  });

  return {
    flow,
    io,
    msManager,
    socket,
    socketEmits,
    voiceRuntime,
    runtimeMetrics,
    metricEvents,
    metricErrors,
    invalidPayloads,
    cleanupCalls,
  };
}

test('voice transport flow joins a user through the server-owned access and worker checks', async () => {
  const { flow, cleanupCalls, metricEvents } = createHarness();
  const replies = [];

  await flow.handleJoin({ channelId: 'voice-1' }, (payload) => replies.push(payload));

  assert.deepEqual(replies, [{
    ok: true,
    rtpCapabilities: { codecs: ['opus'] },
    existingProducers: ['user-2:audio'],
    participants: [{ userId: 'user-1', muted: false }],
  }]);
  assert.equal(cleanupCalls.length, 1);
  assert.deepEqual(cleanupCalls[0].slice(2), ['user-1', 'voice-old']);
  assert.deepEqual(metricEvents.slice(0, 3), [
    ['voice:join_requested', { userId: 'user-1', channelId: 'voice-1' }],
    ['voice:join_ready', {
      userId: 'user-1',
      channelId: 'voice-1',
      existingProducerCount: 1,
      participantCount: 1,
    }],
    ['join', { channelId: 'voice-1', userId: 'user-1' }],
  ]);
});

test('voice transport flow emits new producer events through the socket layer', async () => {
  const { flow, socketEmits, metricEvents } = createHarness();
  const replies = [];

  await flow.handleProduce({
    channelId: 'voice-1',
    transportId: 'transport-1',
    kind: 'audio',
    rtpParameters: { codecs: [] },
    appData: { source: 'microphone' },
  }, (payload) => replies.push(payload));

  assert.deepEqual(replies, [{ ok: true, producerId: 'producer-1', source: 'microphone' }]);
  assert.deepEqual(socketEmits, [[
    'voice:voice-1',
    'voice:new-producer',
    {
      producerId: 'producer-1',
      producerUserId: 'user-1',
      kind: 'audio',
      source: 'microphone',
    },
  ]]);
  assert.deepEqual(metricEvents.slice(-2), [
    ['voice:producer_ready', {
      userId: 'user-1',
      channelId: 'voice-1',
      producerId: 'producer-1',
      kind: 'audio',
      source: 'microphone',
    }],
    ['produce', {
      channelId: 'voice-1',
      userId: 'user-1',
      kind: 'audio',
      source: 'microphone',
    }],
  ]);
});

test('voice transport flow normalizes resume-consumer worker failures', async () => {
  const { flow, metricErrors } = createHarness({
    msManager: {
      getStatsSnapshot: () => ({ workerCount: 0, workersAvailable: false }),
      resumeConsumer: async () => {
        throw new Error('Worker closed');
      },
    },
  });
  const replies = [];
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await flow.handleResumeConsumer({
      channelId: 'voice-1',
      producerId: 'producer-1',
    }, (payload) => replies.push(payload));
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(replies, [{
    ok: false,
    error: VOICE_SERVICE_UNAVAILABLE_ERROR,
  }]);
  assert.deepEqual(metricErrors, [[
    'voice:resume-consumer',
    {
      userId: 'user-1',
      channelId: 'voice-1',
      message: 'Worker closed',
    },
  ]]);
});
