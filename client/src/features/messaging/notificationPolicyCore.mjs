export function isConversationForegrounded({
  activeConversation,
  targetType,
  targetId,
  appForegrounded,
}) {
  if (!appForegrounded) return false;
  return activeConversation?.type === targetType && activeConversation?.id === targetId;
}

export function evaluateRoomMessageNotification({
  activeConversation,
  roomId,
  appForegrounded,
  muteAll = false,
  muteRooms = false,
}) {
  if (muteAll || muteRooms) {
    return { shouldNotify: false, reason: 'muted' };
  }

  if (isConversationForegrounded({
    activeConversation,
    targetType: 'room',
    targetId: roomId,
    appForegrounded,
  })) {
    return { shouldNotify: false, reason: 'foreground-visible' };
  }

  return { shouldNotify: true, reason: 'notify' };
}

export function evaluateDirectMessageNotification({
  activeConversation,
  otherUserId,
  appForegrounded,
  muteAll = false,
  muteDMs = false,
}) {
  if (muteAll || muteDMs) {
    return { shouldNotify: false, reason: 'muted' };
  }

  if (isConversationForegrounded({
    activeConversation,
    targetType: 'dm',
    targetId: otherUserId,
    appForegrounded,
  })) {
    return { shouldNotify: false, reason: 'foreground-visible' };
  }

  return { shouldNotify: true, reason: 'notify' };
}

export function evaluateGuildChatMentionNotification({
  currentGuild,
  messageGuildId,
  guildChatVisible,
  appForegrounded,
  muteAll = false,
}) {
  if (muteAll) {
    return { shouldNotify: false, reason: 'muted' };
  }

  if (guildChatVisible && appForegrounded && currentGuild === messageGuildId) {
    return { shouldNotify: false, reason: 'foreground-visible' };
  }

  return { shouldNotify: true, reason: 'notify' };
}

export function buildRoomMessageNotificationDescriptor({ message, rooms = [] } = {}) {
  const roomId = message?.room_id || null;
  const roomName = rooms.find((room) => room.id === roomId)?.name || 'board';
  const senderName = message?.sender_name || 'Someone';
  const hasAttachments = Array.isArray(message?.attachments) && message.attachments.length > 0;
  const fallbackBody = hasAttachments
    ? `${senderName} sent an attachment in /${roomName}`
    : `${senderName} sent a message in /${roomName}`;

  return {
    title: `/${roomName}`,
    body: message?.encrypted ? '' : String(message?.content || ''),
    fallbackBody,
    route: {
      type: 'room',
      roomId,
      roomName,
    },
  };
}

export function buildDirectMessageNotificationDescriptor({ message } = {}) {
  const senderName = message?.sender_name || 'New DM';
  const hasAttachments = Array.isArray(message?.attachments) && message.attachments.length > 0;
  const fallbackBody = hasAttachments
    ? 'Sent you a DM with an attachment'
    : 'Sent you a DM';

  return {
    title: senderName,
    body: message?.encrypted ? '' : String(message?.content || ''),
    fallbackBody,
    route: {
      type: 'dm',
      userId: message?.sender_id || null,
      username: message?.sender_name || 'Direct Message',
      npub: message?.sender_npub || null,
    },
  };
}

function buildGuildChatMentionFallbackBody(message) {
  const content = String(message?.content || '').trim();
  if (content) return content;

  const attachmentCount = Array.isArray(message?.attachments) ? message.attachments.length : 0;
  if (attachmentCount > 1) {
    return `Sent ${attachmentCount} attachments in /guildchat.`;
  }
  if (attachmentCount === 1) {
    return 'Sent an attachment in /guildchat.';
  }

  return 'Open /guildchat to see the message.';
}

export function buildGuildChatMentionNotificationDescriptor({ message } = {}) {
  return {
    title: `${message?.senderName || 'Someone'} mentioned you in /guildchat`,
    body: String(message?.content || ''),
    fallbackBody: buildGuildChatMentionFallbackBody(message),
    route: {
      type: 'guildchat-mention',
      guildId: message?.guildId || null,
    },
  };
}

export function resolveNotificationRouteAction(payload = {}, { rooms = [], myRooms = [] } = {}) {
  if (payload?.type === 'dm' && payload?.userId) {
    return {
      kind: 'dm',
      conversation: {
        other_user_id: payload.userId,
        other_username: payload.username || 'Direct Message',
        other_npub: payload.npub || null,
      },
    };
  }

  if (payload?.type === 'room' && payload?.roomId) {
    return {
      kind: 'room',
      room: myRooms.find((entry) => entry.id === payload.roomId)
        || rooms.find((entry) => entry.id === payload.roomId)
        || { id: payload.roomId, name: payload.roomName || 'Room' },
    };
  }

  if (payload?.type === 'guildchat-mention') {
    return {
      kind: 'guildchat-home',
      guildId: payload.guildId || null,
    };
  }

  return null;
}
