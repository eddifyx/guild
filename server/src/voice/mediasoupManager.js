const mediasoup = require('mediasoup');
const os = require('os');

const RTC_MIN_PORT = Number(process.env.MEDIASOUP_RTC_MIN_PORT || 10000);
const RTC_MAX_PORT = Number(process.env.MEDIASOUP_RTC_MAX_PORT || 10100);

if (!Number.isInteger(RTC_MIN_PORT) || !Number.isInteger(RTC_MAX_PORT) || RTC_MIN_PORT <= 0 || RTC_MAX_PORT < RTC_MIN_PORT) {
  throw new Error(`Invalid mediasoup RTP port range: ${RTC_MIN_PORT}-${RTC_MAX_PORT}`);
}

const WORKER_SETTINGS = {
  logLevel: 'warn',
  rtcMinPort: RTC_MIN_PORT,
  rtcMaxPort: RTC_MAX_PORT,
};
const INITIAL_AVAILABLE_OUTGOING_BITRATE = Number(
  process.env.MEDIASOUP_INITIAL_OUTGOING_BITRATE || 18_000_000
);

function isPrivateIpv4(address) {
  if (typeof address !== 'string') return false;
  if (address.startsWith('10.')) return true;
  if (address.startsWith('192.168.')) return true;
  const match = address.match(/^172\.(\d+)\./);
  if (!match) return false;
  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function resolveAnnouncedIp() {
  if (process.env.ANNOUNCED_IP) {
    return process.env.ANNOUNCED_IP;
  }

  const candidates = [];
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') continue;
      candidates.push(entry.address);
    }
  }

  const privateAddress = candidates.find(isPrivateIpv4);
  if (privateAddress) return privateAddress;
  if (candidates.length > 0) return candidates[0];
  return '127.0.0.1';
}

const ANNOUNCED_IP = resolveAnnouncedIp();

const ROUTER_MEDIA_CODECS = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
  },
];

const WEBRTC_TRANSPORT_OPTIONS = {
  listenIps: [
    {
      ip: '0.0.0.0',
      announcedIp: ANNOUNCED_IP,
    },
  ],
  enableUdp: true,
  enableTcp: true,
  preferUdp: true,
  initialAvailableOutgoingBitrate: INITIAL_AVAILABLE_OUTGOING_BITRATE,
};

const workers = [];
let nextWorkerIndex = 0;

// Map<channelId, { router, peers: Map<userId, PeerState> }>
const rooms = new Map();

function createPeerState() {
  return {
    sendTransport: null,
    recvTransport: null,
    producers: new Map(),
    consumers: new Map(),
  };
}

async function createWorkers() {
  const numWorkers = Math.min(os.cpus().length, 2);
  console.log(`[mediasoup] Using announced IP ${ANNOUNCED_IP}`);
  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(WORKER_SETTINGS);
    worker.on('died', () => {
      console.error(`mediasoup Worker ${worker.pid} died - removing from pool`);
      const idx = workers.indexOf(worker);
      if (idx !== -1) workers.splice(idx, 1);
      for (const [channelId, room] of rooms) {
        if (room.router.closed) {
          rooms.delete(channelId);
        }
      }
    });
    workers.push(worker);
  }
  console.log(`mediasoup: ${workers.length} worker(s) created`);
}

function getNextWorker() {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available - all workers have died');
  }
  const worker = workers[nextWorkerIndex % workers.length];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  return worker;
}

async function getOrCreateRoom(channelId) {
  if (rooms.has(channelId)) return rooms.get(channelId);
  const worker = getNextWorker();
  const router = await worker.createRouter({ mediaCodecs: ROUTER_MEDIA_CODECS });
  const room = { router, peers: new Map() };
  rooms.set(channelId, room);
  return room;
}

function getRoom(channelId) {
  return rooms.get(channelId) || null;
}

function removeRoom(channelId) {
  const room = rooms.get(channelId);
  if (room) {
    room.router.close();
    rooms.delete(channelId);
  }
}

async function createWebRtcTransport(channelId, userId, direction) {
  const room = await getOrCreateRoom(channelId);
  const transport = await room.router.createWebRtcTransport(WEBRTC_TRANSPORT_OPTIONS);

  if (!room.peers.has(userId)) {
    room.peers.set(userId, createPeerState());
  }

  const peer = room.peers.get(userId);
  if (direction === 'send') {
    if (peer.sendTransport) {
      try { peer.sendTransport.close(); } catch {}
    }
    peer.sendTransport = transport;
  } else {
    if (peer.recvTransport) {
      try { peer.recvTransport.close(); } catch {}
    }
    peer.recvTransport = transport;
  }

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

async function connectTransport(channelId, userId, transportId, dtlsParameters) {
  const room = rooms.get(channelId);
  if (!room) throw new Error('Room not found');
  const peer = room.peers.get(userId);
  if (!peer) throw new Error('Peer not found');

  const transport =
    peer.sendTransport?.id === transportId
      ? peer.sendTransport
      : peer.recvTransport;
  if (!transport) throw new Error('Transport not found');

  await transport.connect({ dtlsParameters });
}

async function produce(channelId, userId, transportId, kind, rtpParameters, appData = {}) {
  const room = rooms.get(channelId);
  if (!room) throw new Error('Room not found');
  const peer = room.peers.get(userId);
  if (!peer || !peer.sendTransport) throw new Error('Send transport not found');

  const source = appData?.source || kind;

  for (const meta of peer.producers.values()) {
    if (meta.source !== source) continue;
    try { meta.producer.close(); } catch {}
  }

  const producer = await peer.sendTransport.produce({
    kind,
    rtpParameters,
    appData: { source },
  });

  const removeProducer = () => {
    if (!peer.producers.has(producer.id)) return;
    peer.producers.delete(producer.id);
  };

  producer.on('transportclose', () => {
    removeProducer();
    try { producer.close(); } catch {}
  });
  if (producer.observer?.on) {
    producer.observer.on('close', removeProducer);
  }

  peer.producers.set(producer.id, {
    producer,
    kind,
    source,
  });

  return {
    producerId: producer.id,
    kind,
    source,
    producer,
  };
}

async function consume(channelId, consumerUserId, producerUserId, producerId, rtpCapabilities) {
  const room = rooms.get(channelId);
  if (!room) throw new Error('Room not found');

  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Cannot consume');
  }

  const consumerPeer = room.peers.get(consumerUserId);
  if (!consumerPeer || !consumerPeer.recvTransport) {
    throw new Error('Recv transport not found');
  }

  const consumer = await consumerPeer.recvTransport.consume({
    producerId,
    rtpCapabilities,
    paused: false,
  });

  consumer.on('transportclose', () => consumer.close());
  consumer.on('producerclose', () => {
    consumer.close();
    consumerPeer.consumers.delete(producerId);
  });

  consumerPeer.consumers.set(producerId, consumer);

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

function removePeer(channelId, userId) {
  const room = rooms.get(channelId);
  if (!room) return;
  const peer = room.peers.get(userId);
  if (!peer) return;

  for (const consumer of peer.consumers.values()) {
    consumer.close();
  }
  for (const meta of peer.producers.values()) {
    meta.producer.close();
  }
  if (peer.sendTransport) peer.sendTransport.close();
  if (peer.recvTransport) peer.recvTransport.close();

  room.peers.delete(userId);
  if (room.peers.size === 0) removeRoom(channelId);
}

function getRoomPeers(channelId) {
  const room = rooms.get(channelId);
  if (!room) return [];
  return [...room.peers.keys()];
}

function getProducersForPeer(channelId, userId) {
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

function getStatsSnapshot() {
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
      if (peer.sendTransport) {
        transportCount += 1;
        roomTransportCount += 1;
      }
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
    announcedIp: ANNOUNCED_IP,
    workerCount: workers.length,
    roomCount: rooms.size,
    peerCount,
    transportCount,
    producerCount,
    consumerCount,
    rooms: roomsSummary,
  };
}

module.exports = {
  createWorkers,
  getOrCreateRoom,
  getRoom,
  removeRoom,
  createWebRtcTransport,
  connectTransport,
  produce,
  consume,
  removePeer,
  getRoomPeers,
  getProducersForPeer,
  getStatsSnapshot,
};
