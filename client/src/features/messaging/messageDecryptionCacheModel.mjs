export const PERSISTED_MESSAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getMessageCacheMapKey(userId, messageId) {
  return userId && messageId ? `${userId}:${messageId}` : null;
}

export function getMessageCiphertext(msg) {
  return msg?._ciphertextContent || msg?.content;
}

export function hashCiphertext(ciphertext) {
  if (typeof ciphertext !== 'string') return '';
  let hash = 5381;
  for (let i = 0; i < ciphertext.length; i += 1) {
    hash = ((hash << 5) + hash) ^ ciphertext.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function sanitizeCachedAttachments(attachments = []) {
  return (attachments || []).map((attachment) => {
    if (!attachment || typeof attachment !== 'object') return attachment;
    const { _previewUrl, ...rest } = attachment;
    return rest;
  });
}
