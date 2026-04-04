const test = require('node:test');
const assert = require('node:assert/strict');

const {
  dropVoiceRoomReference,
  getOrCreateVoiceRoom,
  removeVoicePeer,
  removeVoiceRoom,
  listVoiceRoomPeers,
  listVoicePeerProducers,
  getVoiceRoomsStatsSnapshot,
} = require('../../../server/src/domain/voice/voiceRoomRuntime');

function createTrackedMap(values = []) {
  return new Map(values);
}

test('voice room runtime drops room references only when the matching room is still live', () => {
  const rooms = new Map();
  const room = { router: { closed: false } };
  rooms.set('voice-1', room);

  assert.equal(dropVoiceRoomReference(rooms, 'voice-1', { router: { closed: false } }), false);
  assert.equal(rooms.has('voice-1'), true);
  assert.equal(dropVoiceRoomReference(rooms, 'voice-1', room), true);
  assert.equal(rooms.has('voice-1'), false);
});

test('voice room runtime creates rooms once and tears down stale routers safely', async () => {
  const created = [];
  const routerHandlers = {};
  const observerHandlers = {};
  const rooms = new Map();
  const worker = {
    pid: 42,
    async createRouter(options) {
      created.push(options);
      return {
        closed: false,
        on(event, handler) {
          routerHandlers[event] = handler;
        },
        observer: {
          on(event, handler) {
            observerHandlers[event] = handler;
          },
        },
      };
    },
  };

  const first = await getOrCreateVoiceRoom({
    rooms,
    channelId: 'voice-1',
    getNextWorkerFn: () => worker,
    createRouterOptions: { mediaCodecs: ['opus'] },
  });
  const second = await getOrCreateVoiceRoom({
    rooms,
    channelId: 'voice-1',
    getNextWorkerFn: () => {
      throw new Error('should not create a second room');
    },
    createRouterOptions: { mediaCodecs: ['vp8'] },
  });

  assert.equal(first, second);
  assert.deepEqual(created, [{ mediaCodecs: ['opus'] }]);

  observerHandlers.close();
  assert.equal(rooms.has('voice-1'), false);
});

test('voice room runtime removes peers, producers, consumers, and empty rooms canonically', () => {
  const closed = [];
  const rooms = new Map();
  const room = {
    router: { close() { closed.push('router'); } },
    peers: createTrackedMap([[
      'user-1',
      {
        consumers: createTrackedMap([
          ['consumer-1', { close() { closed.push('consumer'); } }],
        ]),
        consumerState: createTrackedMap([
          ['consumer-1', { quality: 'good' }],
        ]),
        producers: createTrackedMap([
          ['producer-1', { producer: { close() { closed.push('producer'); } }, kind: 'audio', source: 'microphone' }],
        ]),
        sendTransports: createTrackedMap([
          ['voice', { close() { closed.push('send'); } }],
        ]),
        recvTransport: { close() { closed.push('recv'); } },
      },
    ]]),
  };
  rooms.set('voice-1', room);

  removeVoicePeer({
    rooms,
    channelId: 'voice-1',
    userId: 'user-1',
    removeRoomFn: (channelId) => removeVoiceRoom(rooms, channelId),
  });

  assert.deepEqual(closed, ['consumer', 'producer', 'send', 'recv', 'router']);
  assert.equal(rooms.has('voice-1'), false);
});

test('voice room runtime lists peers, producers, and room stats through the canonical shape', () => {
  const rooms = new Map();
  rooms.set('voice-b', {
    peers: createTrackedMap([
      ['user-2', {
        sendTransports: createTrackedMap([['voice', { id: 'send-1' }]]),
        recvTransport: { id: 'recv-1' },
        producers: createTrackedMap([
          ['producer-1', { kind: 'audio', source: 'microphone' }],
        ]),
        consumers: createTrackedMap([
          ['consumer-1', { id: 'consumer-1' }],
        ]),
      }],
    ]),
  });
  rooms.set('voice-a', {
    peers: createTrackedMap([
      ['user-1', {
        sendTransports: createTrackedMap(),
        recvTransport: null,
        producers: createTrackedMap(),
        consumers: createTrackedMap(),
      }],
      ['user-3', {
        sendTransports: createTrackedMap([
          ['voice', { id: 'send-3' }],
        ]),
        recvTransport: null,
        producers: createTrackedMap([
          ['producer-3', { kind: 'video', source: 'screen-video' }],
        ]),
        consumers: createTrackedMap(),
      }],
    ]),
  });

  assert.deepEqual(listVoiceRoomPeers(rooms, 'voice-a'), ['user-1', 'user-3']);
  assert.deepEqual(listVoicePeerProducers(rooms, 'voice-a', 'user-3'), [{
    producerId: 'producer-3',
    producerUserId: 'user-3',
    kind: 'video',
    source: 'screen-video',
  }]);

  assert.deepEqual(getVoiceRoomsStatsSnapshot({
    rooms,
    announcedIp: '1.2.3.4',
    workerCount: 1,
    targetWorkerCount: 2,
    recoveryPending: true,
  }), {
    announcedIp: '1.2.3.4',
    workerCount: 1,
    targetWorkerCount: 2,
    workersAvailable: true,
    degraded: true,
    recoveryPending: true,
    roomCount: 2,
    peerCount: 3,
    transportCount: 3,
    producerCount: 2,
    consumerCount: 1,
    rooms: [
      { channelId: 'voice-a', peers: 2, transports: 1, producers: 1, consumers: 0 },
      { channelId: 'voice-b', peers: 1, transports: 2, producers: 1, consumers: 1 },
    ],
  });
});
