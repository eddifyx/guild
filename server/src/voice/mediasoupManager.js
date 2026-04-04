const mediasoup = require('mediasoup');
const {
  buildRouterMediaCodecs,
  buildWebRtcTransportOptions,
  buildWorkerSettings,
  resolveAnnouncedIp,
  resolveTargetWorkerCount,
} = require('../domain/voice/voiceConfig');
const {
  getTransportById,
} = require('../domain/voice/voiceTransportState');
const {
  dropVoiceRoomReference,
  getOrCreateVoiceRoom,
  listVoicePeerProducers,
  listVoiceRoomPeers,
  removeVoicePeer,
  removeVoiceRoom,
} = require('../domain/voice/voiceRoomRuntime');
const {
  buildVoiceRoomStatsSnapshot,
} = require('../domain/voice/voiceRoomStatsSnapshot');
const {
  prepareVoiceTransportRegistration,
} = require('../domain/voice/voiceTransportRuntime');
const {
  createVoiceTransportMediaRuntime,
} = require('../domain/voice/voiceTransportMediaRuntime');
const {
  attachVoiceWorkerLifecycle,
  getNextVoiceWorker,
  refillVoiceWorkers,
  scheduleVoiceWorkerRefill,
} = require('../domain/voice/voiceWorkerRuntime');

const WORKER_SETTINGS = buildWorkerSettings({
  minPort: process.env.MEDIASOUP_RTC_MIN_PORT || 10000,
  maxPort: process.env.MEDIASOUP_RTC_MAX_PORT || 10100,
});
const INITIAL_AVAILABLE_OUTGOING_BITRATE = Number(
  process.env.MEDIASOUP_INITIAL_OUTGOING_BITRATE || 2_000_000
);
const MAX_INCOMING_BITRATE = Number(
  process.env.MEDIASOUP_MAX_INCOMING_BITRATE || 12_000_000
);
const MAX_OUTGOING_BITRATE = Number(
  process.env.MEDIASOUP_MAX_OUTGOING_BITRATE || 12_000_000
);
const ENABLE_EXPERIMENTAL_SCREEN_CODECS = process.env.MEDIASOUP_ENABLE_EXPERIMENTAL_SCREEN_CODECS === '1';
const ENABLE_EXPERIMENTAL_AV1 = process.env.MEDIASOUP_ENABLE_EXPERIMENTAL_AV1 === '1';
const ANNOUNCED_IP = resolveAnnouncedIp();
const ROUTER_MEDIA_CODECS = buildRouterMediaCodecs({
  enableExperimentalScreenCodecs: ENABLE_EXPERIMENTAL_SCREEN_CODECS,
  enableExperimentalAv1: ENABLE_EXPERIMENTAL_AV1,
});
const WEBRTC_TRANSPORT_OPTIONS = buildWebRtcTransportOptions({
  announcedIp: ANNOUNCED_IP,
  initialAvailableOutgoingBitrate: INITIAL_AVAILABLE_OUTGOING_BITRATE,
});
const TARGET_WORKER_COUNT = resolveTargetWorkerCount();
const WORKER_RESPAWN_DELAY_MS = 1_000;
const workers = [];
let nextWorkerIndex = 0;
let workerRefillPromise = null;
let workerRefillTimer = null;

// Map<channelId, { router, peers: Map<userId, PeerState>, workerPid: number }>
const rooms = new Map();
const voiceTransportMediaRuntime = createVoiceTransportMediaRuntime({
  rooms,
});

function scheduleWorkerRefill(delayMs = WORKER_RESPAWN_DELAY_MS) {
  scheduleVoiceWorkerRefill({
    workers,
    targetWorkerCount: TARGET_WORKER_COUNT,
    getWorkerRefillPromiseFn: () => workerRefillPromise,
    getWorkerRefillTimerFn: () => workerRefillTimer,
    setWorkerRefillTimerFn: (value) => {
      workerRefillTimer = value;
    },
    delayMs,
    refillWorkersFn: refillWorkers,
    setTimeoutFn: setTimeout,
    logErrorFn: console.error,
  });
}

function attachWorkerLifecycle(worker) {
  attachVoiceWorkerLifecycle({
    worker,
    workers,
    rooms,
    getNextWorkerIndexFn: () => nextWorkerIndex,
    setNextWorkerIndexFn: (value) => {
      nextWorkerIndex = value;
    },
    dropVoiceRoomReferenceFn: dropVoiceRoomReference,
    scheduleVoiceWorkerRefillFn: scheduleWorkerRefill,
    logErrorFn: console.error,
  });
}

async function spawnWorker() {
  const worker = await mediasoup.createWorker(WORKER_SETTINGS);
  attachWorkerLifecycle(worker);
  workers.push(worker);
  return worker;
}

async function refillWorkers() {
  return refillVoiceWorkers({
    workers,
    targetWorkerCount: TARGET_WORKER_COUNT,
    getWorkerRefillPromiseFn: () => workerRefillPromise,
    setWorkerRefillPromiseFn: (value) => {
      workerRefillPromise = value;
    },
    scheduleVoiceWorkerRefillFn: scheduleWorkerRefill,
    spawnWorkerFn: spawnWorker,
    logErrorFn: console.error,
  });
}

async function createWorkers() {
  console.log(`[mediasoup] Using announced IP ${ANNOUNCED_IP}`);
  await refillWorkers();
  console.log(`mediasoup: ${workers.length} worker(s) ready`);
}

function getNextWorker() {
  return getNextVoiceWorker({
    workers,
    nextWorkerIndex,
    setNextWorkerIndexFn: (value) => {
      nextWorkerIndex = value;
    },
  });
}

async function getOrCreateRoom(channelId) {
  return getOrCreateVoiceRoom({
    rooms,
    channelId,
    getNextWorkerFn: getNextWorker,
    createRouterOptions: { mediaCodecs: ROUTER_MEDIA_CODECS },
  });
}

function getRoom(channelId) {
  return rooms.get(channelId) || null;
}

function removeRoom(channelId) {
  removeVoiceRoom(rooms, channelId);
}

function hasAvailableWorkers() {
  return workers.length > 0;
}

async function createWebRtcTransport(channelId, userId, direction, purpose = 'voice') {
  const room = await getOrCreateRoom(channelId);
  const transport = await room.router.createWebRtcTransport(WEBRTC_TRANSPORT_OPTIONS);
  return prepareVoiceTransportRegistration({
    room,
    userId,
    direction,
    purpose,
    transport,
    maxIncomingBitrate: MAX_INCOMING_BITRATE,
    maxOutgoingBitrate: MAX_OUTGOING_BITRATE,
    logWarnFn: console.warn,
  });
}

async function connectTransport(channelId, userId, transportId, dtlsParameters) {
  const room = rooms.get(channelId);
  if (!room) throw new Error('Room not found');
  const peer = room.peers.get(userId);
  if (!peer) throw new Error('Peer not found');

  const transport = getTransportById(peer, transportId);
  if (!transport) throw new Error('Transport not found');

  await transport.connect({ dtlsParameters });
}

async function produce(channelId, userId, transportId, kind, rtpParameters, appData = {}) {
  return voiceTransportMediaRuntime.produce(channelId, userId, transportId, kind, rtpParameters, appData);
}

async function consume(channelId, consumerUserId, producerUserId, producerId, rtpCapabilities) {
  return voiceTransportMediaRuntime.consume(channelId, consumerUserId, producerUserId, producerId, rtpCapabilities);
}

async function resumeConsumer(channelId, consumerUserId, producerId) {
  return voiceTransportMediaRuntime.resumeConsumer(channelId, consumerUserId, producerId);
}

async function updateConsumerQuality(channelId, consumerUserId, producerId, payload = {}) {
  return voiceTransportMediaRuntime.updateConsumerQuality(channelId, consumerUserId, producerId, payload);
}

function removePeer(channelId, userId) {
  removeVoicePeer({
    rooms,
    channelId,
    userId,
    removeRoomFn: removeRoom,
  });
}

function getRoomPeers(channelId) {
  return listVoiceRoomPeers(rooms, channelId);
}

function getProducersForPeer(channelId, userId) {
  return listVoicePeerProducers(rooms, channelId, userId);
}

function getStatsSnapshot() {
  return buildVoiceRoomStatsSnapshot({
    rooms,
    announcedIp: ANNOUNCED_IP,
    workerCount: workers.length,
    targetWorkerCount: TARGET_WORKER_COUNT,
    recoveryPending: Boolean(workerRefillPromise || workerRefillTimer),
  });
}

module.exports = {
  createWorkers,
  getOrCreateRoom,
  getRoom,
  removeRoom,
  hasAvailableWorkers,
  createWebRtcTransport,
  connectTransport,
  produce,
  consume,
  resumeConsumer,
  updateConsumerQuality,
  removePeer,
  getRoomPeers,
  getProducersForPeer,
  getStatsSnapshot,
};
