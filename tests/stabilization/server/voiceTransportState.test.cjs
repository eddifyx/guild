const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPeerState,
  getSendTransportById,
  getSendTransportByPurpose,
  getTransportById,
  normalizeTransportPurpose,
} = require('../../../server/src/domain/voice/voiceTransportState');

test('voice transport state builds canonical peer state containers', () => {
  const peerState = createPeerState();

  assert.equal(peerState.recvTransport, null);
  assert.equal(peerState.sendTransports instanceof Map, true);
  assert.equal(peerState.producers instanceof Map, true);
  assert.equal(peerState.consumers instanceof Map, true);
  assert.equal(peerState.consumerState instanceof Map, true);
});

test('voice transport state normalizes transport purposes and resolves transports by purpose and id', () => {
  const voiceTransport = { id: 'send-voice' };
  const screenTransport = { id: 'send-screen' };
  const recvTransport = { id: 'recv-1' };
  const peer = createPeerState();
  peer.sendTransports.set('voice', voiceTransport);
  peer.sendTransports.set('screen', screenTransport);
  peer.recvTransport = recvTransport;

  assert.equal(normalizeTransportPurpose('send', 'voice'), 'voice');
  assert.equal(normalizeTransportPurpose('send', 'screen'), 'screen');
  assert.equal(normalizeTransportPurpose('recv', 'screen'), 'recv');

  assert.equal(getSendTransportByPurpose(peer, 'voice'), voiceTransport);
  assert.equal(getSendTransportByPurpose(peer, 'screen'), screenTransport);
  assert.equal(getSendTransportById(peer, 'send-screen'), screenTransport);
  assert.equal(getTransportById(peer, 'recv-1'), recvTransport);
  assert.equal(getTransportById(peer, 'send-voice'), voiceTransport);
  assert.equal(getTransportById(peer, 'missing'), null);
});
