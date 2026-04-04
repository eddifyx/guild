export const MAX_LIVE_GUILDCHAT_MESSAGES = 200;
export const GUILDCHAT_NOTIFICATION_TTL_MS = 30_000;

export function trimLiveGuildChatMessages(messages, maxMessages = MAX_LIVE_GUILDCHAT_MESSAGES) {
  if (messages.length <= maxMessages) return messages;
  return messages.slice(-maxMessages);
}

export function mergeGuildChatAttachments(previousAttachments = [], nextAttachments = []) {
  if (!Array.isArray(nextAttachments) || nextAttachments.length === 0) {
    return Array.isArray(nextAttachments) ? nextAttachments : [];
  }

  return nextAttachments.map((nextAttachment, index) => {
    const matchedPrevious = previousAttachments.find((previousAttachment) => (
      (previousAttachment.id && nextAttachment.id && previousAttachment.id === nextAttachment.id)
      || (
        (previousAttachment.serverFileUrl || previousAttachment.fileUrl)
        && (nextAttachment.serverFileUrl || nextAttachment.fileUrl)
        && (previousAttachment.serverFileUrl || previousAttachment.fileUrl) === (nextAttachment.serverFileUrl || nextAttachment.fileUrl)
      )
      || (
        previousAttachment.originalFileName
        && nextAttachment.originalFileName
        && previousAttachment.originalFileName === nextAttachment.originalFileName
        && index < previousAttachments.length
      )
    )) || previousAttachments[index];

    if (!matchedPrevious?._previewUrl) return nextAttachment;
    return {
      ...nextAttachment,
      _previewUrl: matchedPrevious._previewUrl,
    };
  });
}

export function mergeGuildChatMessage(messages, incomingMessage, maxMessages = MAX_LIVE_GUILDCHAT_MESSAGES) {
  const nextMessage = {
    ...incomingMessage,
    pending: false,
    failed: false,
  };
  const messageIndex = messages.findIndex((message) => (
    message.id === nextMessage.id
    || (!!nextMessage.clientNonce && message.clientNonce === nextMessage.clientNonce)
  ));

  if (messageIndex === -1) {
    return trimLiveGuildChatMessages([...messages, nextMessage], maxMessages);
  }

  const next = [...messages];
  next[messageIndex] = {
    ...next[messageIndex],
    ...nextMessage,
    attachments: mergeGuildChatAttachments(next[messageIndex]?.attachments, nextMessage.attachments),
  };
  return next;
}

export function updateGuildChatMessage(messages, messageId, updater) {
  const messageIndex = messages.findIndex((message) => message.id === messageId);
  if (messageIndex === -1) return messages;

  const next = [...messages];
  next[messageIndex] = updater(next[messageIndex]);
  return next;
}

export function createLocalGuildChatId({
  cryptoObject = typeof globalThis !== 'undefined' ? globalThis.crypto : null,
  nowFn = Date.now,
  randomFn = Math.random,
} = {}) {
  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }
  return `guildchat-${nowFn()}-${randomFn().toString(16).slice(2)}`;
}

export function buildOptimisticGuildChatAttachments(attachments = [], createLocalId = createLocalGuildChatId) {
  return attachments.map((attachment) => ({
    id: attachment.fileId || attachment.id || createLocalId(),
    fileUrl: attachment.fileUrl || attachment.file_url,
    serverFileUrl: attachment.fileUrl || attachment.file_url,
    fileName: attachment.fileName,
    fileType: attachment.fileType,
    fileSize: attachment.fileSize,
    originalFileName: attachment._originalName,
    originalFileType: attachment._originalType,
    originalFileSize: attachment._originalSize,
    encryptionKey: attachment._encryptionKey,
    encryptionDigest: attachment._encryptionDigest,
    _previewUrl: attachment._previewUrl || null,
  }));
}

export function buildGuildChatAttachmentRequestPayload(attachments = []) {
  return attachments.map((attachment) => ({
    fileId: attachment.fileId,
    encryptionKey: attachment._encryptionKey,
    encryptionDigest: attachment._encryptionDigest,
    originalFileName: attachment._originalName,
    originalFileType: attachment._originalType,
    originalFileSize: attachment._originalSize,
  }));
}

export function buildOptimisticGuildChatMessage({
  guildId,
  content,
  user,
  myMember,
  mentions = [],
  attachments = [],
  clientNonce,
  createLocalId = createLocalGuildChatId,
  nowIso = () => new Date().toISOString(),
} = {}) {
  return {
    id: clientNonce,
    clientNonce,
    guildId,
    content,
    senderId: user.userId,
    senderName: user.username || 'You',
    senderColor: myMember?.avatarColor || myMember?.avatar_color || user.avatarColor || '#40FF40',
    senderPicture: myMember?.profilePicture || myMember?.profile_picture || user.profilePicture || null,
    createdAt: nowIso(),
    pending: true,
    failed: false,
    mentions,
    attachments: buildOptimisticGuildChatAttachments(attachments, createLocalId),
  };
}

export function markGuildChatMessageFailed(messages, clientNonce) {
  return messages.map((message) => (
    message.clientNonce === clientNonce
      ? { ...message, pending: false, failed: true }
      : message
  ));
}

export function markGuildChatMessageSent(messages, clientNonce, messageId) {
  return messages.map((message) => (
    message.clientNonce === clientNonce
      ? { ...message, id: messageId || message.id, pending: false }
      : message
  ));
}

export function guildChatMessageMentionsUser(message, userId) {
  return Array.isArray(message?.mentions)
    && message.mentions.some((mention) => mention?.userId === userId);
}

export function shouldRecordGuildChatMentionNotification(cache, messageId, {
  now = Date.now(),
  ttlMs = GUILDCHAT_NOTIFICATION_TTL_MS,
} = {}) {
  if (!messageId) return true;

  for (const [seenMessageId, seenAt] of cache.entries()) {
    if (now - seenAt > ttlMs) {
      cache.delete(seenMessageId);
    }
  }

  if (cache.has(messageId)) {
    return false;
  }

  cache.set(messageId, now);
  return true;
}
