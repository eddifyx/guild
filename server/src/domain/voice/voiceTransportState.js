function createPeerState() {
  return {
    sendTransports: new Map(),
    recvTransport: null,
    producers: new Map(),
    consumers: new Map(),
    consumerState: new Map(),
  };
}

function normalizeTransportPurpose(direction, purpose) {
  if (direction !== 'send') {
    return 'recv';
  }

  return purpose === 'screen' ? 'screen' : 'voice';
}

function getSendTransportByPurpose(peer, purpose = 'voice') {
  return peer?.sendTransports?.get(normalizeTransportPurpose('send', purpose)) || null;
}

function getSendTransportById(peer, transportId) {
  if (!peer?.sendTransports || !transportId) return null;

  for (const transport of peer.sendTransports.values()) {
    if (transport?.id === transportId) {
      return transport;
    }
  }

  return null;
}

function getTransportById(peer, transportId) {
  if (!peer || !transportId) return null;
  if (peer.recvTransport?.id === transportId) {
    return peer.recvTransport;
  }

  return getSendTransportById(peer, transportId);
}

module.exports = {
  createPeerState,
  getSendTransportById,
  getSendTransportByPurpose,
  getTransportById,
  normalizeTransportPurpose,
};
