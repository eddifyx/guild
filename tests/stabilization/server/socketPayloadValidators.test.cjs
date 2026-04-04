const test = require('node:test');
const assert = require('node:assert/strict');

const { ERROR_CODES } = require('../../../server/src/contracts/errorCodes');
const {
  validateGuildChatGuildPayload,
  validateGuildChatMessagePayload,
} = require('../../../server/src/socket/validators/guildChatPayloads');
const {
  validateVoiceConnectTransportPayload,
  validateVoiceConsumePayload,
  validateVoiceCreateTransportPayload,
  validateVoiceJoinPayload,
  validateVoiceProducePayload,
  validateVoiceToggleDeafenPayload,
  validateVoiceToggleMutePayload,
} = require('../../../server/src/socket/validators/voicePayloads');

test('validateGuildChatGuildPayload rejects missing guild id', () => {
  const result = validateGuildChatGuildPayload({});
  assert.equal(result.ok, false);
  assert.equal(result.code, ERROR_CODES.INVALID_GUILDCHAT_PAYLOAD);
});

test('validateGuildChatMessagePayload rejects malformed mention payloads', () => {
  const result = validateGuildChatMessagePayload({
    guildId: 'guild-1',
    content: 'hello',
    mentions: 'not-an-array',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, ERROR_CODES.INVALID_GUILDCHAT_MENTION_PAYLOAD);
});

test('validateVoiceJoinPayload accepts a minimal join payload', () => {
  const result = validateVoiceJoinPayload({ channelId: 'voice-1' });
  assert.deepEqual(result, {
    ok: true,
    value: { channelId: 'voice-1' },
  });
});

test('validateVoiceCreateTransportPayload rejects unknown directions', () => {
  const result = validateVoiceCreateTransportPayload({
    channelId: 'voice-1',
    direction: 'sideways',
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, ERROR_CODES.INVALID_VOICE_PAYLOAD);
});

test('validateVoiceConnectTransportPayload requires DTLS parameters', () => {
  const result = validateVoiceConnectTransportPayload({
    channelId: 'voice-1',
    transportId: 'transport-1',
  });

  assert.equal(result.ok, false);
});

test('validateVoiceProducePayload requires kind and RTP parameters', () => {
  const result = validateVoiceProducePayload({
    channelId: 'voice-1',
    transportId: 'transport-1',
    kind: 'audio',
    rtpParameters: {},
    appData: { source: 'microphone' },
  });

  assert.equal(result.ok, true);
});

test('validateVoiceConsumePayload requires producer metadata and RTP capabilities', () => {
  const result = validateVoiceConsumePayload({
    channelId: 'voice-1',
    producerId: 'producer-1',
    producerUserId: 'user-2',
    rtpCapabilities: {},
  });

  assert.equal(result.ok, true);
});

test('validateVoice mute and deafen payloads require explicit booleans', () => {
  const muteResult = validateVoiceToggleMutePayload({
    channelId: 'voice-1',
    muted: true,
  });
  const deafenResult = validateVoiceToggleDeafenPayload({
    channelId: 'voice-1',
    deafened: false,
  });

  assert.equal(muteResult.ok, true);
  assert.equal(deafenResult.ok, true);
});
