const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVoiceRoomStatsSnapshot,
} = require('../../../server/src/domain/voice/voiceRoomStatsSnapshot');

function createTrackedMap(values = []) {
  return new Map(values);
}

test('voice room stats snapshot model canonicalizes room and worker metrics', () => {
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

  assert.deepEqual(buildVoiceRoomStatsSnapshot({
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
