const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DM_UNAVAILABLE_ERROR,
  buildDirectMessage,
  buildDirectSenderKeyPayload,
  buildRoomMessage,
  canUsersDirectMessage,
  filterVisibleDirectMessageConversations,
  getDirectMessageAvailabilityFailure,
  normalizeLiveMessageContent,
  validateDirectSenderKeyMetadata,
} = require('../../../server/src/domain/messaging/directMessages');

test('getDirectMessageAvailabilityFailure keeps the shared-guild rule server-owned', () => {
  assert.equal(canUsersDirectMessage({ guild_id: 'guild-1' }), true);
  assert.equal(canUsersDirectMessage(null), false);
  assert.deepEqual(getDirectMessageAvailabilityFailure({ guild_id: 'guild-1' }), { ok: true });
  assert.deepEqual(getDirectMessageAvailabilityFailure(null), {
    ok: false,
    error: DM_UNAVAILABLE_ERROR,
  });
});

test('filterVisibleDirectMessageConversations keeps only still-visible conversations', () => {
  const conversations = [
    { other_user_id: 'user-1', created_at: '2026-03-25 12:00:00' },
    { other_user_id: 'user-2', created_at: '2026-03-25 12:01:00' },
    { other_user_id: null, created_at: '2026-03-25 12:02:00' },
  ];

  assert.deepEqual(
    filterVisibleDirectMessageConversations(conversations, {
      canUseDirectMessagesWithUser: (otherUserId) => otherUserId === 'user-2',
    }),
    [{ other_user_id: 'user-2', created_at: '2026-03-25 12:01:00' }]
  );
});

test('buildRoomMessage shapes the canonical room live-message payload', () => {
  assert.deepEqual(buildRoomMessage({
    messageId: 'message-1',
    roomId: 'room-1',
    content: 'hello',
    sender: {
      username: 'Builder',
      avatar_color: '#40FF40',
      npub: 'npub1builder',
      profile_picture: 'https://example.com/p.png',
    },
    senderId: 'user-1',
    attachments: [{ id: 'att-1' }],
    encrypted: true,
    clientNonce: 'nonce-1',
    createdAt: '2026-03-24 18:00:00',
  }), {
    id: 'message-1',
    content: 'hello',
    sender_id: 'user-1',
    sender_name: 'Builder',
    sender_color: '#40FF40',
    sender_npub: 'npub1builder',
    sender_picture: 'https://example.com/p.png',
    room_id: 'room-1',
    dm_partner_id: null,
    attachments: [{ id: 'att-1' }],
    created_at: '2026-03-24 18:00:00',
    encrypted: 1,
    client_nonce: 'nonce-1',
  });
});

test('buildDirectMessage shapes the canonical dm live-message payload', () => {
  assert.deepEqual(buildDirectMessage({
    messageId: 'message-2',
    dmPartnerId: 'user-2',
    content: '',
    sender: {
      username: 'Scout',
      avatar_color: '#55AAFF',
      npub: null,
      profile_picture: null,
    },
    senderId: 'user-1',
    attachments: [],
    encrypted: false,
    clientNonce: null,
    createdAt: '2026-03-24 18:05:00',
  }), {
    id: 'message-2',
    content: null,
    sender_id: 'user-1',
    sender_name: 'Scout',
    sender_color: '#55AAFF',
    sender_npub: null,
    sender_picture: null,
    room_id: null,
    dm_partner_id: 'user-2',
    attachments: [],
    created_at: '2026-03-24 18:05:00',
    encrypted: 0,
    client_nonce: null,
  });
});

test('validateDirectSenderKeyMetadata enforces metadata shape and room membership', () => {
  assert.deepEqual(validateDirectSenderKeyMetadata({}), { ok: true });
  assert.deepEqual(validateDirectSenderKeyMetadata({
    roomId: 'room-1',
    distributionId: null,
  }), {
    ok: false,
    error: 'Invalid sender key metadata',
  });
  assert.deepEqual(validateDirectSenderKeyMetadata({
    roomId: 'room-1',
    distributionId: 'distribution-1',
    senderRoomMember: true,
    recipientRoomMember: false,
  }), {
    ok: false,
    error: 'Sender key metadata does not match room membership',
  });
});

test('buildDirectSenderKeyPayload keeps the wire payload stable', () => {
  assert.deepEqual(buildDirectSenderKeyPayload({
    controlMessageId: 'control-1',
    fromUserId: 'user-1',
    senderNpub: 'npub1builder',
    envelope: 'sealed',
    roomId: 'room-1',
    distributionId: 'distribution-1',
  }), {
    id: 'control-1',
    fromUserId: 'user-1',
    senderNpub: 'npub1builder',
    envelope: 'sealed',
    roomId: 'room-1',
    distributionId: 'distribution-1',
  });
});

test('normalizeLiveMessageContent keeps only string content and preserves empty-to-null behavior', () => {
  assert.equal(normalizeLiveMessageContent('hi'), 'hi');
  assert.equal(normalizeLiveMessageContent(''), null);
  assert.equal(normalizeLiveMessageContent(null), null);
});
