const {
  createPeerState,
  getSendTransportByPurpose,
  normalizeTransportPurpose,
} = require('./voiceTransportState');

async function prepareVoiceTransportRegistration({
  room,
  userId,
  direction,
  purpose = 'voice',
  transport,
  maxIncomingBitrate,
  maxOutgoingBitrate,
  logWarnFn = console.warn,
} = {}) {
  const transportPurpose = normalizeTransportPurpose(direction, purpose);

  if (direction === 'send' && Number.isFinite(maxIncomingBitrate) && maxIncomingBitrate > 0) {
    try {
      await transport.setMaxIncomingBitrate(maxIncomingBitrate);
    } catch (err) {
      logWarnFn('[mediasoup] Failed to cap incoming bitrate:', err?.message || err);
    }
  }

  if (direction === 'recv' && Number.isFinite(maxOutgoingBitrate) && maxOutgoingBitrate > 0) {
    try {
      await transport.setMaxOutgoingBitrate(maxOutgoingBitrate);
    } catch (err) {
      logWarnFn('[mediasoup] Failed to cap outgoing bitrate:', err?.message || err);
    }
  }

  if (!room.peers.has(userId)) {
    room.peers.set(userId, createPeerState());
  }

  const peer = room.peers.get(userId);
  if (direction === 'send') {
    const existingSendTransport = getSendTransportByPurpose(peer, transportPurpose);
    if (existingSendTransport) {
      try { existingSendTransport.close(); } catch {}
    }
    peer.sendTransports.set(transportPurpose, transport);
  } else {
    if (peer.recvTransport) {
      try { peer.recvTransport.close(); } catch {}
    }
    peer.recvTransport = transport;
  }

  const removeStoredTransport = () => {
    const livePeer = room.peers.get(userId);
    if (!livePeer) return;

    if (direction === 'send') {
      const storedTransport = livePeer.sendTransports.get(transportPurpose);
      if (storedTransport?.id === transport.id) {
        livePeer.sendTransports.delete(transportPurpose);
      }
      return;
    }

    if (livePeer.recvTransport?.id === transport.id) {
      livePeer.recvTransport = null;
    }
  };

  if (transport.observer?.on) {
    transport.observer.on('close', removeStoredTransport);
  }

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

module.exports = {
  prepareVoiceTransportRegistration,
};
