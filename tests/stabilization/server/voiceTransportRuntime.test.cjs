const test = require('node:test');
const assert = require('node:assert/strict');

const {
  prepareVoiceTransportRegistration,
} = require('../../../server/src/domain/voice/voiceTransportRuntime');

function createTransport() {
  const closeHandlers = [];
  return {
    id: 'transport-1',
    iceParameters: { usernameFragment: 'u', password: 'p' },
    iceCandidates: [{ foundation: '1' }],
    dtlsParameters: { role: 'auto' },
    observer: {
      on(event, handler) {
        if (event === 'close') closeHandlers.push(handler);
      },
    },
    closeHandlers,
    close() {
      closeHandlers.forEach((handler) => handler());
    },
    async setMaxIncomingBitrate() {
      return undefined;
    },
    async setMaxOutgoingBitrate() {
      return undefined;
    },
  };
}

test('voice transport runtime registers send transports and clears them on close', async () => {
  const room = { peers: new Map() };
  const existingTransport = { id: 'transport-old', closeCalled: false, close() { this.closeCalled = true; } };
  room.peers.set('user-1', {
    sendTransports: new Map([['voice', existingTransport]]),
    recvTransport: null,
    producers: new Map(),
    consumers: new Map(),
    consumerState: new Map(),
  });
  const transport = createTransport();

  const descriptor = await prepareVoiceTransportRegistration({
    room,
    userId: 'user-1',
    direction: 'send',
    purpose: 'voice',
    transport,
    maxIncomingBitrate: 2_000_000,
    maxOutgoingBitrate: 12_000_000,
    logWarnFn: () => {},
  });

  assert.deepEqual(descriptor, {
    id: 'transport-1',
    iceParameters: { usernameFragment: 'u', password: 'p' },
    iceCandidates: [{ foundation: '1' }],
    dtlsParameters: { role: 'auto' },
  });
  assert.equal(existingTransport.closeCalled, true);
  assert.equal(room.peers.get('user-1').sendTransports.get('voice'), transport);

  transport.close();
  assert.equal(room.peers.get('user-1').sendTransports.has('voice'), false);
});

test('voice transport runtime registers recv transports and clears the prior recv transport', async () => {
  const room = { peers: new Map() };
  const existingRecv = { id: 'recv-old', closeCalled: false, close() { this.closeCalled = true; } };
  room.peers.set('user-1', {
    sendTransports: new Map(),
    recvTransport: existingRecv,
    producers: new Map(),
    consumers: new Map(),
    consumerState: new Map(),
  });
  const transport = createTransport();

  await prepareVoiceTransportRegistration({
    room,
    userId: 'user-1',
    direction: 'recv',
    purpose: 'voice',
    transport,
    maxIncomingBitrate: 2_000_000,
    maxOutgoingBitrate: 12_000_000,
    logWarnFn: () => {},
  });

  assert.equal(existingRecv.closeCalled, true);
  assert.equal(room.peers.get('user-1').recvTransport, transport);

  transport.close();
  assert.equal(room.peers.get('user-1').recvTransport, null);
});
