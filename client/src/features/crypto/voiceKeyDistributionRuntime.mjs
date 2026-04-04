export function createRetryableVoiceKeyError(message) {
  const error = new Error(message);
  error.retryable = true;
  return error;
}

function normalizeVoiceRuntimeId(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function normalizeVoiceParticipantIdSet(participantUserIds) {
  const normalized = new Set();

  if (participantUserIds instanceof Set) {
    for (const value of participantUserIds.values()) {
      const nextId = normalizeVoiceRuntimeId(value);
      if (nextId) normalized.add(nextId);
    }
    return normalized;
  }

  if (Array.isArray(participantUserIds)) {
    for (const value of participantUserIds) {
      const nextId = normalizeVoiceRuntimeId(value);
      if (nextId) normalized.add(nextId);
    }
  }

  return normalized;
}

export function emitVoiceKeyEnvelopeRuntime(socket, toUserId, envelope) {
  return new Promise((resolve, reject) => {
    socket.emit('dm:sender_key', { toUserId, envelope }, (response) => {
      if (response?.ok) {
        resolve();
        return;
      }
      reject(new Error(response?.error || 'Voice key delivery was rejected by the server.'));
    });
  });
}

export function buildVoiceKeyDistributionPayload({ channelId, key, epoch, toBase64Fn }) {
  return JSON.stringify({
    type: 'voice_key_distribution',
    channelId,
    key: toBase64Fn(key),
    epoch,
  });
}

export async function distributeVoiceKeyRuntime({
  channelId,
  participantUserIds,
  key,
  epoch,
  socket,
  myUserId,
  toBase64Fn,
  encryptDirectMessageFn,
  emitVoiceKeyEnvelopeFn = emitVoiceKeyEnvelopeRuntime,
  logErrorFn = console.error,
}) {
  const failures = [];

  for (const participantId of participantUserIds) {
    if (participantId === myUserId) continue;

    try {
      const payload = buildVoiceKeyDistributionPayload({
        channelId,
        key,
        epoch,
        toBase64Fn,
      });
      const envelope = await encryptDirectMessageFn(participantId, payload);
      await emitVoiceKeyEnvelopeFn(socket, participantId, envelope);
    } catch (error) {
      logErrorFn(`Failed to distribute voice key to ${participantId}:`, error);
      failures.push(participantId);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Failed to distribute the secure voice key to ${failures.join(', ')}`);
  }
}

export function processDecryptedVoiceKeyRuntime({
  fromUserId,
  payload,
  channelId,
  participantUserIds,
  setVoiceKeyFn,
}) {
  if (payload?.type !== 'voice_key_distribution') return false;

  const normalizedChannelId = normalizeVoiceRuntimeId(channelId);
  const normalizedPayloadChannelId = normalizeVoiceRuntimeId(payload.channelId);
  const normalizedFromUserId = normalizeVoiceRuntimeId(fromUserId);
  const normalizedParticipantUserIds = normalizeVoiceParticipantIdSet(participantUserIds);

  if (!normalizedChannelId) {
    throw createRetryableVoiceKeyError('Voice key received before the local channel was ready.');
  }
  if (normalizedPayloadChannelId !== normalizedChannelId) {
    return false;
  }
  if (!normalizedFromUserId || !normalizedParticipantUserIds.has(normalizedFromUserId)) {
    throw createRetryableVoiceKeyError('Voice key received before the participant list was ready.');
  }

  return setVoiceKeyFn(payload.key, payload.epoch);
}
