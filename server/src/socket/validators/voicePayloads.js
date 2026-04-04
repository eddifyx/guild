const { ERROR_CODES } = require('../../contracts/errorCodes');

const VALID_TRANSPORT_DIRECTIONS = new Set(['send', 'recv']);
const VALID_PRODUCER_KINDS = new Set(['audio', 'video']);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalString(value) {
  if (value == null) return null;
  return typeof value === 'string' ? value.trim() : '';
}

function readOptionalFiniteNumber(value) {
  if (value == null) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function ok(value) {
  return { ok: true, value };
}

function fail(error) {
  return { ok: false, error, code: ERROR_CODES.INVALID_VOICE_PAYLOAD };
}

function validateVoiceChannelPayload(payload, { missingChannelError = 'Voice channel ID required' } = {}) {
  if (!isPlainObject(payload)) {
    return fail('Invalid payload');
  }

  const channelId = readRequiredString(payload.channelId);
  if (!channelId) {
    return fail(missingChannelError);
  }

  return ok({ channelId });
}

function validateVoiceJoinPayload(payload) {
  return validateVoiceChannelPayload(payload);
}

function validateVoiceCreateTransportPayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;

  const direction = readRequiredString(payload.direction);
  if (!VALID_TRANSPORT_DIRECTIONS.has(direction)) {
    return fail('Invalid voice transport direction');
  }

  const purpose = readOptionalString(payload.purpose);
  if (payload.purpose != null && !purpose) {
    return fail('Invalid voice transport purpose');
  }

  return ok({
    channelId: channelValidation.value.channelId,
    direction,
    purpose: purpose || null,
  });
}

function validateVoiceConnectTransportPayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;

  const transportId = readRequiredString(payload.transportId);
  if (!transportId) {
    return fail('Transport ID required');
  }
  if (!isPlainObject(payload.dtlsParameters)) {
    return fail('Invalid DTLS parameters');
  }

  return ok({
    channelId: channelValidation.value.channelId,
    transportId,
    dtlsParameters: payload.dtlsParameters,
  });
}

function validateVoiceProducePayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;

  const transportId = readRequiredString(payload.transportId);
  if (!transportId) {
    return fail('Transport ID required');
  }

  const kind = readRequiredString(payload.kind);
  if (!VALID_PRODUCER_KINDS.has(kind)) {
    return fail('Invalid producer kind');
  }

  if (!isPlainObject(payload.rtpParameters)) {
    return fail('Invalid RTP parameters');
  }

  if (payload.appData != null && !isPlainObject(payload.appData)) {
    return fail('Invalid producer app data');
  }

  return ok({
    channelId: channelValidation.value.channelId,
    transportId,
    kind,
    rtpParameters: payload.rtpParameters,
    appData: payload.appData || {},
  });
}

function validateVoiceConsumePayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;

  const producerId = readRequiredString(payload.producerId);
  const producerUserId = readRequiredString(payload.producerUserId);
  if (!producerId) {
    return fail('Producer ID required');
  }
  if (!producerUserId) {
    return fail('Producer user ID required');
  }
  if (!isPlainObject(payload.rtpCapabilities)) {
    return fail('Invalid RTP capabilities');
  }

  return ok({
    channelId: channelValidation.value.channelId,
    producerId,
    producerUserId,
    rtpCapabilities: payload.rtpCapabilities,
  });
}

function validateVoiceResumeConsumerPayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;

  const producerId = readRequiredString(payload.producerId);
  if (!producerId) {
    return fail('Producer ID required');
  }

  return ok({
    channelId: channelValidation.value.channelId,
    producerId,
  });
}

function validateVoiceConsumerQualityPayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;

  const producerId = readRequiredString(payload.producerId);
  if (!producerId) {
    return fail('Producer ID required');
  }

  return ok({
    channelId: channelValidation.value.channelId,
    producerId,
    availableIncomingBitrate: readOptionalFiniteNumber(payload.availableIncomingBitrate),
    framesPerSecond: readOptionalFiniteNumber(payload.framesPerSecond),
    jitterBufferDelayMs: readOptionalFiniteNumber(payload.jitterBufferDelayMs),
    freezeCount: readOptionalFiniteNumber(payload.freezeCount),
    pauseCount: readOptionalFiniteNumber(payload.pauseCount),
  });
}

function validateVoiceToggleMutePayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;
  if (typeof payload.muted !== 'boolean') {
    return fail('Invalid mute state');
  }
  return ok({
    channelId: channelValidation.value.channelId,
    muted: payload.muted,
  });
}

function validateVoiceToggleDeafenPayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;
  if (typeof payload.deafened !== 'boolean') {
    return fail('Invalid deafen state');
  }
  return ok({
    channelId: channelValidation.value.channelId,
    deafened: payload.deafened,
  });
}

function validateVoiceSpeakingPayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;
  if (typeof payload.speaking !== 'boolean') {
    return fail('Invalid speaking state');
  }
  return ok({
    channelId: channelValidation.value.channelId,
    speaking: payload.speaking,
  });
}

function validateVoiceScreenShareStatePayload(payload) {
  const channelValidation = validateVoiceChannelPayload(payload);
  if (!channelValidation.ok) return channelValidation;
  if (typeof payload.sharing !== 'boolean') {
    return fail('Invalid screen share state');
  }
  return ok({
    channelId: channelValidation.value.channelId,
    sharing: payload.sharing,
  });
}

function validateVoiceLeavePayload(payload) {
  return validateVoiceChannelPayload(payload);
}

module.exports = {
  validateVoiceChannelPayload,
  validateVoiceJoinPayload,
  validateVoiceCreateTransportPayload,
  validateVoiceConnectTransportPayload,
  validateVoiceProducePayload,
  validateVoiceConsumePayload,
  validateVoiceResumeConsumerPayload,
  validateVoiceConsumerQualityPayload,
  validateVoiceToggleMutePayload,
  validateVoiceToggleDeafenPayload,
  validateVoiceSpeakingPayload,
  validateVoiceScreenShareStatePayload,
  validateVoiceLeavePayload,
};
