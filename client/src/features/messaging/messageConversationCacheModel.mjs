export const MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000;
export const PERSISTED_CONVERSATION_SNAPSHOT_KEY = 'guild:conversation-snapshots:v1';
export const PERSISTED_CONVERSATION_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
export const PERSISTED_CONVERSATION_SNAPSHOT_LIMIT = 20;
export const PERSISTED_CONVERSATION_MESSAGE_LIMIT = 30;

export function getConversationCacheKey(conversation, userId = null) {
  return conversation && userId ? `${userId}:${conversation.type}:${conversation.id}` : null;
}

export function cloneMessages(messages) {
  return Array.isArray(messages) ? messages.map((message) => ({ ...message })) : [];
}

export function sanitizeSnapshotAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const { _previewUrl, ...rest } = attachment;
  return rest;
}

export function sanitizeMessageForSnapshot(message) {
  if (!message || typeof message !== 'object' || !message.id) return null;

  return {
    id: message.id,
    content: typeof message.content === 'string' ? message.content : null,
    sender_id: message.sender_id || null,
    sender_name: message.sender_name || '',
    sender_color: message.sender_color || null,
    sender_picture: message.sender_picture || null,
    sender_npub: message.sender_npub || null,
    room_id: message.room_id || null,
    dm_partner_id: message.dm_partner_id || null,
    created_at: message.created_at || null,
    edited_at: message.edited_at || null,
    encrypted: !!message.encrypted,
    _decrypted: !!message._decrypted,
    _decryptionPending: !!message._decryptionPending,
    _decryptionFailed: !!message._decryptionFailed,
    _decryptionError: message._decryptionError || null,
    _decryptionBucket: message._decryptionBucket || null,
    _decryptedAttachments: Array.isArray(message._decryptedAttachments)
      ? message._decryptedAttachments.map(sanitizeSnapshotAttachment).filter(Boolean)
      : [],
    attachments: Array.isArray(message.attachments)
      ? message.attachments.map(sanitizeSnapshotAttachment).filter(Boolean)
      : [],
  };
}

export function getMessageTimestampValue(message) {
  const raw = message?.created_at ?? message?.createdAt ?? message?.timestamp ?? null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized)
      ? normalized
      : `${normalized}Z`;
    const parsed = Date.parse(zoned);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export function sortMessagesChronologically(messages) {
  return (messages || [])
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const timeDelta = getMessageTimestampValue(a.message) - getMessageTimestampValue(b.message);
      if (timeDelta !== 0) return timeDelta;
      return a.index - b.index;
    })
    .map(({ message }) => message);
}
