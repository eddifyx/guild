const DM_UNAVAILABLE_ERROR = 'Direct messages are only available while you share a guild with this user.';

function canUsersDirectMessage(sharedGuildMembership) {
  return !!sharedGuildMembership;
}

function getDirectMessageAvailabilityFailure(canUseDirectMessages) {
  if (canUsersDirectMessage(canUseDirectMessages)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: DM_UNAVAILABLE_ERROR,
  };
}

function filterVisibleDirectMessageConversations(
  conversations = [],
  { canUseDirectMessagesWithUser } = {}
) {
  if (!Array.isArray(conversations) || typeof canUseDirectMessagesWithUser !== 'function') {
    return [];
  }

  return conversations.filter((conversation) => {
    const otherUserId = conversation?.other_user_id;
    return !!otherUserId && canUsersDirectMessage(canUseDirectMessagesWithUser(otherUserId));
  });
}

function normalizeLiveMessageContent(content) {
  if (typeof content !== 'string') return null;
  return content || null;
}

function buildRoomMessage({
  messageId,
  roomId,
  content,
  sender,
  senderId,
  attachments = [],
  encrypted = false,
  clientNonce = null,
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    id: messageId,
    content: normalizeLiveMessageContent(content),
    sender_id: senderId,
    sender_name: sender?.username || 'Unknown',
    sender_color: sender?.avatar_color || null,
    sender_npub: sender?.npub || null,
    sender_picture: sender?.profile_picture || null,
    room_id: roomId,
    dm_partner_id: null,
    attachments: Array.isArray(attachments) ? attachments : [],
    created_at: createdAt,
    encrypted: encrypted ? 1 : 0,
    client_nonce: clientNonce,
  };
}

function buildDirectMessage({
  messageId,
  dmPartnerId,
  content,
  sender,
  senderId,
  attachments = [],
  encrypted = false,
  clientNonce = null,
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    id: messageId,
    content: normalizeLiveMessageContent(content),
    sender_id: senderId,
    sender_name: sender?.username || 'Unknown',
    sender_color: sender?.avatar_color || null,
    sender_npub: sender?.npub || null,
    sender_picture: sender?.profile_picture || null,
    room_id: null,
    dm_partner_id: dmPartnerId,
    attachments: Array.isArray(attachments) ? attachments : [],
    created_at: createdAt,
    encrypted: encrypted ? 1 : 0,
    client_nonce: clientNonce,
  };
}

function validateDirectSenderKeyMetadata({
  roomId = null,
  distributionId = null,
  senderRoomMember = false,
  recipientRoomMember = false,
} = {}) {
  if (roomId === null && distributionId === null) {
    return { ok: true };
  }

  if (typeof roomId !== 'string' || !roomId || typeof distributionId !== 'string' || !distributionId) {
    return {
      ok: false,
      error: 'Invalid sender key metadata',
    };
  }

  if (!senderRoomMember || !recipientRoomMember) {
    return {
      ok: false,
      error: 'Sender key metadata does not match room membership',
    };
  }

  return { ok: true };
}

function buildDirectSenderKeyPayload({
  controlMessageId = null,
  fromUserId,
  senderNpub = null,
  envelope,
  roomId = null,
  distributionId = null,
} = {}) {
  return {
    id: controlMessageId,
    fromUserId,
    senderNpub: senderNpub || null,
    envelope,
    roomId,
    distributionId,
  };
}

module.exports = {
  DM_UNAVAILABLE_ERROR,
  buildDirectMessage,
  buildDirectSenderKeyPayload,
  buildRoomMessage,
  canUsersDirectMessage,
  filterVisibleDirectMessageConversations,
  getDirectMessageAvailabilityFailure,
  normalizeLiveMessageContent,
  validateDirectSenderKeyMetadata,
};
