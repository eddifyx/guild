const VOICE_SERVICE_UNAVAILABLE_ERROR = 'Voice service is temporarily unavailable. Try again in a moment.';

function hasAvailableVoiceWorkers(msManager) {
  if (typeof msManager.hasAvailableWorkers === 'function') {
    return msManager.hasAvailableWorkers();
  }

  const stats = typeof msManager.getStatsSnapshot === 'function'
    ? msManager.getStatsSnapshot()
    : null;
  const workerCount = Number(stats?.workerCount) || 0;
  const workersAvailable = stats?.workersAvailable !== false;
  return workersAvailable && workerCount > 0;
}

function getVoiceSocketError(msManager, err, fallbackMessage) {
  const message = String(err?.message || '');
  if (
    !hasAvailableVoiceWorkers(msManager)
    || message.includes('No mediasoup workers available')
    || message.includes('Worker closed')
    || message.includes('Router closed')
  ) {
    return VOICE_SERVICE_UNAVAILABLE_ERROR;
  }
  return fallbackMessage;
}

function verifyVoiceChannelAccess({ channelId, userId, getVoiceChannelById, isGuildMember } = {}) {
  const voiceChannel = channelId ? getVoiceChannelById.get(channelId) : null;
  if (!voiceChannel) {
    return { ok: false, error: 'Voice channel not found' };
  }

  if (voiceChannel.guild_id && !isGuildMember.get(voiceChannel.guild_id, userId)) {
    return { ok: false, error: 'Not a member of this guild' };
  }

  return { ok: true, channel: voiceChannel };
}

function listExistingRoomProducers({ msManager, channelId, skipUserId = null } = {}) {
  const existingProducers = [];
  for (const peerId of msManager.getRoomPeers(channelId)) {
    if (peerId === skipUserId) continue;
    existingProducers.push(...msManager.getProducersForPeer(channelId, peerId));
  }
  return existingProducers;
}

function buildProducerPayload({ producerId, producerUserId, kind, source }) {
  return {
    producerId,
    producerUserId,
    kind,
    source,
  };
}

function attachProducerCloseBroadcast({ io, channelId, producerMeta } = {}) {
  if (!producerMeta?.producer) return;

  const payload = buildProducerPayload(producerMeta);
  let broadcasted = false;
  const broadcastClosed = () => {
    if (broadcasted) return;
    broadcasted = true;
    io.to(`voice:${channelId}`).emit('voice:producer-closed', payload);
  };

  if (producerMeta.producer.observer?.on) {
    producerMeta.producer.observer.on('close', broadcastClosed);
  }
  if (producerMeta.producer.on) {
    producerMeta.producer.on('transportclose', broadcastClosed);
  }
}

module.exports = {
  VOICE_SERVICE_UNAVAILABLE_ERROR,
  attachProducerCloseBroadcast,
  buildProducerPayload,
  getVoiceSocketError,
  hasAvailableVoiceWorkers,
  listExistingRoomProducers,
  verifyVoiceChannelAccess,
};
