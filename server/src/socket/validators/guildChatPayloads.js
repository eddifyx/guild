const { ERROR_CODES } = require('../../contracts/errorCodes');

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readRequiredString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ok(value) {
  return { ok: true, value };
}

function fail(error, code = ERROR_CODES.INVALID_GUILDCHAT_PAYLOAD) {
  return { ok: false, error, code };
}

function validateGuildChatGuildPayload(payload) {
  if (!isPlainObject(payload)) {
    return fail('Invalid payload');
  }

  const guildId = readRequiredString(payload.guildId);
  if (!guildId) {
    return fail('Guild ID required');
  }

  return ok({ guildId });
}

function validateGuildChatMessagePayload(payload) {
  const guildValidation = validateGuildChatGuildPayload(payload);
  if (!guildValidation.ok) {
    return guildValidation;
  }

  if (payload.content != null && typeof payload.content !== 'string') {
    return fail('Invalid message content');
  }

  if (payload.attachments != null && !Array.isArray(payload.attachments)) {
    return fail('Invalid attachment payload');
  }

  if (payload.mentions != null && !Array.isArray(payload.mentions)) {
    return fail('Invalid mention payload', ERROR_CODES.INVALID_GUILDCHAT_MENTION_PAYLOAD);
  }

  if (payload.clientNonce != null && (typeof payload.clientNonce !== 'string' || payload.clientNonce.length > 128)) {
    return fail('Invalid client nonce');
  }

  return ok({
    guildId: guildValidation.value.guildId,
    content: payload.content,
    attachments: payload.attachments,
    clientNonce: payload.clientNonce,
    mentions: payload.mentions,
  });
}

module.exports = {
  validateGuildChatGuildPayload,
  validateGuildChatMessagePayload,
};
