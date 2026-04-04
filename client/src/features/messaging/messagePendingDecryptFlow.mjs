import { getConversationDecryptFailureMessage } from './messageDecryptPresentation.mjs';

function messageBelongsToConversation(message, conversation, userId) {
  if (!conversation) return false;

  if (conversation.type === 'room') {
    return message?.room_id === conversation.id;
  }

  if (conversation.type === 'dm') {
    return !message?.room_id && (
      (message?.sender_id === conversation.id && message?.dm_partner_id === userId) ||
      (message?.sender_id === userId && message?.dm_partner_id === conversation.id)
    );
  }

  return false;
}

export function getPendingDecryptVisibilityDelay({
  messages = [],
  conversation,
  userId = null,
  now = Date.now(),
  visibleTimeoutMs,
} = {}) {
  const pendingMessages = messages.filter((message) => (
    message?.encrypted
    && message?._decryptionPending
    && messageBelongsToConversation(message, conversation, userId)
  ));
  if (pendingMessages.length === 0) return null;

  return pendingMessages.reduce((soonest, message) => {
    const pendingSince = message?._decryptionPendingSince || now;
    const expiresIn = Math.max(0, visibleTimeoutMs - (now - pendingSince));
    return Math.min(soonest, expiresIn);
  }, visibleTimeoutMs);
}

export function expirePendingDecryptMessages({
  messages = [],
  conversation,
  userId = null,
  now = Date.now(),
  visibleTimeoutMs,
} = {}) {
  if (!conversation) {
    return { changed: false, messages };
  }

  let changed = false;
  const nextMessages = messages.map((message) => {
    if (
      !message?.encrypted
      || !message?._decryptionPending
      || !messageBelongsToConversation(message, conversation, userId)
    ) {
      return message;
    }

    const pendingSince = message?._decryptionPendingSince || now;
    if (now - pendingSince < visibleTimeoutMs) {
      return message;
    }

    changed = true;
    return {
      ...message,
      _decryptionPending: false,
      _decryptionFailed: true,
      _decryptionError: getConversationDecryptFailureMessage(message?._decryptionBucket),
    };
  });

  return changed ? { changed: true, messages: nextMessages } : { changed: false, messages };
}
