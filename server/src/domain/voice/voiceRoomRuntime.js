const {
  buildVoiceRoomStatsSnapshot,
} = require('./voiceRoomStatsSnapshot');

function dropVoiceRoomReference(rooms, channelId, roomRef = null) {
  const currentRoom = rooms.get(channelId);
  if (!currentRoom) return false;
  if (roomRef && currentRoom !== roomRef) return false;
  rooms.delete(channelId);
  return true;
}

async function getOrCreateVoiceRoom({
  rooms,
  channelId,
  getNextWorkerFn,
  createRouterOptions,
} = {}) {
  const existingRoom = rooms.get(channelId);
  if (existingRoom) {
    if (!existingRoom.router.closed) {
      return existingRoom;
    }
    dropVoiceRoomReference(rooms, channelId, existingRoom);
  }

  const worker = getNextWorkerFn();
  const router = await worker.createRouter(createRouterOptions);
  const room = {
    router,
    peers: new Map(),
    workerPid: worker.pid,
  };

  const cleanupRoomReference = () => {
    dropVoiceRoomReference(rooms, channelId, room);
  };
  router.on('workerclose', cleanupRoomReference);
  router.observer?.on('close', cleanupRoomReference);

  rooms.set(channelId, room);
  return room;
}

function removeVoiceRoom(rooms, channelId) {
  const room = rooms.get(channelId);
  if (!room) return;
  room.router.close();
  dropVoiceRoomReference(rooms, channelId, room);
}

function removeVoicePeer({
  rooms,
  channelId,
  userId,
  removeRoomFn,
} = {}) {
  const room = rooms.get(channelId);
  if (!room) return;
  const peer = room.peers.get(userId);
  if (!peer) return;

  for (const consumer of peer.consumers.values()) {
    consumer.close();
  }
  peer.consumerState.clear();
  for (const meta of peer.producers.values()) {
    meta.producer.close();
  }
  for (const transport of peer.sendTransports.values()) {
    transport.close();
  }
  if (peer.recvTransport) peer.recvTransport.close();

  room.peers.delete(userId);
  if (room.peers.size === 0) {
    removeRoomFn(channelId);
  }
}

function listVoiceRoomPeers(rooms, channelId) {
  const room = rooms.get(channelId);
  if (!room) return [];
  return [...room.peers.keys()];
}

function listVoicePeerProducers(rooms, channelId, userId) {
  const room = rooms.get(channelId);
  if (!room) return [];
  const peer = room.peers.get(userId);
  if (!peer) return [];
  return [...peer.producers.entries()].map(([producerId, meta]) => ({
    producerId,
    producerUserId: userId,
    kind: meta.kind,
    source: meta.source,
  }));
}

function getVoiceRoomsStatsSnapshot(payload = {}) {
  return buildVoiceRoomStatsSnapshot(payload);
}

module.exports = {
  dropVoiceRoomReference,
  getOrCreateVoiceRoom,
  removeVoiceRoom,
  removeVoicePeer,
  listVoiceRoomPeers,
  listVoicePeerProducers,
  getVoiceRoomsStatsSnapshot,
};
