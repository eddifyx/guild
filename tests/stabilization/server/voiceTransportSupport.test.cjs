const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VOICE_SERVICE_UNAVAILABLE_ERROR,
  attachProducerCloseBroadcast,
  buildProducerPayload,
  getVoiceSocketError,
  hasAvailableVoiceWorkers,
  listExistingRoomProducers,
  verifyVoiceChannelAccess,
} = require('../../../server/src/domain/voice/voiceTransportSupport');

test('voice transport support prefers explicit manager availability when present', () => {
  assert.equal(hasAvailableVoiceWorkers({
    hasAvailableWorkers: () => true,
  }), true);
  assert.equal(hasAvailableVoiceWorkers({
    hasAvailableWorkers: () => false,
  }), false);
});

test('voice transport support normalizes mediasoup worker failures to the shared unavailable error', () => {
  const manager = {
    getStatsSnapshot: () => ({ workerCount: 0, workersAvailable: false }),
  };

  assert.equal(
    getVoiceSocketError(manager, new Error('Worker closed'), 'fallback'),
    VOICE_SERVICE_UNAVAILABLE_ERROR,
  );
  assert.equal(
    getVoiceSocketError({ getStatsSnapshot: () => ({ workerCount: 1, workersAvailable: true }) }, new Error('Other failure'), 'fallback'),
    'fallback',
  );
});

test('voice transport support enforces channel existence and guild membership', () => {
  const getVoiceChannelById = {
    get: (channelId) => channelId === 'voice-1' ? { id: 'voice-1', guild_id: 'guild-1' } : null,
  };
  const isGuildMember = {
    get: (guildId, userId) => guildId === 'guild-1' && userId === 'user-1',
  };

  assert.deepEqual(verifyVoiceChannelAccess({
    channelId: 'missing',
    userId: 'user-1',
    getVoiceChannelById,
    isGuildMember,
  }), { ok: false, error: 'Voice channel not found' });

  assert.deepEqual(verifyVoiceChannelAccess({
    channelId: 'voice-1',
    userId: 'user-2',
    getVoiceChannelById,
    isGuildMember,
  }), { ok: false, error: 'Not a member of this guild' });

  assert.deepEqual(verifyVoiceChannelAccess({
    channelId: 'voice-1',
    userId: 'user-1',
    getVoiceChannelById,
    isGuildMember,
  }), {
    ok: true,
    channel: { id: 'voice-1', guild_id: 'guild-1' },
  });
});

test('voice transport support omits the current user and flattens producer lists', () => {
  const producers = listExistingRoomProducers({
    msManager: {
      getRoomPeers: () => ['user-1', 'user-2', 'user-3'],
      getProducersForPeer: (_channelId, peerId) => [`${peerId}:audio`],
    },
    channelId: 'voice-1',
    skipUserId: 'user-2',
  });

  assert.deepEqual(producers, ['user-1:audio', 'user-3:audio']);
});

test('voice transport support keeps the producer wire shape stable', () => {
  assert.deepEqual(buildProducerPayload({
    producerId: 'producer-1',
    producerUserId: 'user-1',
    kind: 'audio',
    source: 'microphone',
  }), {
    producerId: 'producer-1',
    producerUserId: 'user-1',
    kind: 'audio',
    source: 'microphone',
  });
});

test('voice transport support emits producer-closed only once', () => {
  const handlers = {};
  const observerHandlers = {};
  const emitted = [];

  attachProducerCloseBroadcast({
    io: {
      to(room) {
        return {
          emit(event, payload) {
            emitted.push([room, event, payload]);
          },
        };
      },
    },
    channelId: 'voice-1',
    producerMeta: {
      producerId: 'producer-1',
      producerUserId: 'user-1',
      kind: 'audio',
      source: 'microphone',
      producer: {
        on(event, handler) {
          handlers[event] = handler;
        },
        observer: {
          on(event, handler) {
            observerHandlers[event] = handler;
          },
        },
      },
    },
  });

  observerHandlers.close();
  handlers.transportclose();

  assert.deepEqual(emitted, [[
    'voice:voice-1',
    'voice:producer-closed',
    {
      producerId: 'producer-1',
      producerUserId: 'user-1',
      kind: 'audio',
      source: 'microphone',
    },
  ]]);
});
