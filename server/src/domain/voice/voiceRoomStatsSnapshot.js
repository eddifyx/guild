function buildVoiceRoomStatsSnapshot({
  rooms,
  announcedIp,
  workerCount,
  targetWorkerCount,
  recoveryPending,
} = {}) {
  let peerCount = 0;
  let transportCount = 0;
  let producerCount = 0;
  let consumerCount = 0;
  const roomsSummary = [];

  for (const [channelId, room] of rooms) {
    let roomTransportCount = 0;
    let roomProducerCount = 0;
    let roomConsumerCount = 0;

    peerCount += room.peers.size;

    for (const peer of room.peers.values()) {
      transportCount += peer.sendTransports.size;
      roomTransportCount += peer.sendTransports.size;
      if (peer.recvTransport) {
        transportCount += 1;
        roomTransportCount += 1;
      }

      producerCount += peer.producers.size;
      consumerCount += peer.consumers.size;
      roomProducerCount += peer.producers.size;
      roomConsumerCount += peer.consumers.size;
    }

    roomsSummary.push({
      channelId,
      peers: room.peers.size,
      transports: roomTransportCount,
      producers: roomProducerCount,
      consumers: roomConsumerCount,
    });
  }

  roomsSummary.sort((a, b) => b.peers - a.peers || a.channelId.localeCompare(b.channelId));

  return {
    announcedIp,
    workerCount,
    targetWorkerCount,
    workersAvailable: workerCount > 0,
    degraded: workerCount < targetWorkerCount,
    recoveryPending: Boolean(recoveryPending),
    roomCount: rooms.size,
    peerCount,
    transportCount,
    producerCount,
    consumerCount,
    rooms: roomsSummary,
  };
}

module.exports = {
  buildVoiceRoomStatsSnapshot,
};
