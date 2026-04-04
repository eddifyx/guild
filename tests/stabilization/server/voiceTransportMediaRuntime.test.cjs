const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createVoiceTransportMediaRuntime,
} = require('../../../server/src/domain/voice/voiceTransportMediaRuntime');

function createProducerTransport() {
  return {
    id: 'send-transport',
    async produce(options) {
      const handlers = {};
      return {
        id: 'producer-2',
        on(event, handler) {
          handlers[event] = handler;
        },
        observer: {
          on(event, handler) {
            if (event === 'close') handlers.close = handler;
          },
        },
        closeCalled: false,
        close() {
          this.closeCalled = true;
        },
        emit(event) {
          if (handlers[event]) handlers[event]();
        },
      };
    },
  };
}

function createConsumerTransport() {
  const handlers = {};
  return {
    id: 'recv-transport',
    handlers,
    async consume(options) {
      handlers.consume = options;
      return {
        id: 'consumer-1',
        kind: 'video',
        rtpParameters: { codecs: ['vp8'] },
        currentLayers: { spatialLayer: null },
        preferredLayers: { spatialLayer: null },
        score: { score: 10 },
        type: 'simulcast',
        on(event, handler) {
          handlers[event] = handler;
        },
        observer: { on() {} },
        closeCalled: false,
        resumeCalled: false,
        close() {
          this.closeCalled = true;
        },
        async resume() {
          this.resumeCalled = true;
        },
        async requestKeyFrame() {
          handlers.keyFrameRequested = (handlers.keyFrameRequested || 0) + 1;
        },
        async setPreferredLayers() {
          handlers.setPreferredLayersCalled = true;
        },
      };
    },
  };
}

test('voice transport media runtime replaces old producers and cleans them up on close', async () => {
  const existingProducer = {
    closeCalled: false,
    close() {
      this.closeCalled = true;
    },
  };
  const sendTransport = createProducerTransport();
  const room = {
    router: { canConsume: () => true },
    peers: new Map([
      ['user-1', {
        sendTransports: new Map([['voice', sendTransport]]),
        recvTransport: null,
        producers: new Map([
          ['producer-old', { producer: existingProducer, kind: 'audio', source: 'microphone' }],
        ]),
        consumers: new Map(),
        consumerState: new Map(),
      }],
    ]),
  };
  const runtime = createVoiceTransportMediaRuntime({ rooms: new Map([['voice-1', room]]) });

  const produced = await runtime.produce(
    'voice-1',
    'user-1',
    'send-transport',
    'audio',
    { codecs: ['opus'] },
    { source: 'microphone' },
  );

  assert.equal(existingProducer.closeCalled, true);
  assert.equal(produced.producerId, 'producer-2');
  assert.equal(room.peers.get('user-1').producers.has('producer-2'), true);

  produced.producer.emit('transportclose');
  assert.equal(room.peers.get('user-1').producers.has('producer-2'), false);
});

test('voice transport media runtime consumes screen video, resumes it, and updates quality state', async () => {
  const sendTransport = createProducerTransport();
  const recvTransport = createConsumerTransport();
  const room = {
    router: { canConsume: () => true },
    peers: new Map([
      ['producer-user', {
        sendTransports: new Map([['voice', sendTransport]]),
        recvTransport: null,
        producers: new Map([
          ['producer-1', { producer: { close() {} }, kind: 'video', source: 'screen-video' }],
        ]),
        consumers: new Map(),
        consumerState: new Map(),
      }],
      ['consumer-user', {
        sendTransports: new Map(),
        recvTransport,
        producers: new Map(),
        consumers: new Map(),
        consumerState: new Map(),
      }],
    ]),
  };
  const runtime = createVoiceTransportMediaRuntime({ rooms: new Map([['voice-1', room]]) });

  const consumerData = await runtime.consume(
    'voice-1',
    'consumer-user',
    'producer-user',
    'producer-1',
    { codecs: ['vp8'] },
  );

  assert.deepEqual(consumerData, {
    id: 'consumer-1',
    producerId: 'producer-1',
    kind: 'video',
    rtpParameters: { codecs: ['vp8'] },
    paused: true,
  });
  assert.equal(room.peers.get('consumer-user').consumerState.get('producer-1').source, 'screen-video');

  recvTransport.handlers.layerschange({ spatialLayer: 1 });
  assert.equal(recvTransport.handlers.keyFrameRequested, 1);

  room.peers.get('consumer-user').consumerState.get('producer-1').lastKeyFrameRequestAtMs = 0;
  await runtime.resumeConsumer('voice-1', 'consumer-user', 'producer-1');
  assert.equal(room.peers.get('consumer-user').consumers.get('producer-1').resumeCalled, true);
  assert.equal(recvTransport.handlers.keyFrameRequested, 2);

  assert.equal(await runtime.updateConsumerQuality('voice-1', 'consumer-user', 'producer-1', {
    availableIncomingBitrate: 9_000_000,
    framesPerSecond: 30,
    jitterBufferDelayMs: 80,
    freezeCount: 0,
  }), true);
});
