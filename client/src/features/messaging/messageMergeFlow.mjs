export function getAttachmentIdentity(attachment, index) {
  if (!attachment) return String(index);
  return attachment.serverFileUrl
    || attachment.fileUrl
    || attachment.file_url
    || attachment.originalFileName
    || attachment._originalName
    || attachment.fileName
    || attachment.file_name
    || String(index);
}

export function mergeDecryptedAttachments(existingAttachments = [], incomingAttachments = []) {
  if (!Array.isArray(incomingAttachments) || incomingAttachments.length === 0) {
    return existingAttachments || [];
  }
  if (!Array.isArray(existingAttachments) || existingAttachments.length === 0) {
    return incomingAttachments || [];
  }

  const existingByIdentity = new Map(
    existingAttachments.map((attachment, index) => [getAttachmentIdentity(attachment, index), attachment])
  );

  return incomingAttachments.map((attachment, index) => {
    const existingAttachment = existingByIdentity.get(getAttachmentIdentity(attachment, index));
    if (!existingAttachment) return attachment;
    return {
      ...existingAttachment,
      ...attachment,
      _previewUrl: attachment._previewUrl || existingAttachment._previewUrl || null,
    };
  });
}

export function preserveReadableMessage(existing, incoming) {
  if (!existing || !incoming || !existing._decrypted) return incoming;
  const mergedIdentity = {
    sender_id: incoming.sender_id ?? existing.sender_id ?? null,
    sender_name: incoming.sender_name || existing.sender_name || '',
    sender_color: incoming.sender_color || existing.sender_color || null,
    sender_picture: incoming.sender_picture || existing.sender_picture || null,
    sender_npub: incoming.sender_npub || existing.sender_npub || null,
  };

  if (incoming._decrypted) {
    return {
      ...incoming,
      ...mergedIdentity,
      _decryptedAttachments: mergeDecryptedAttachments(
        existing._decryptedAttachments || [],
        incoming._decryptedAttachments || []
      ),
      _ciphertextContent: existing._ciphertextContent || incoming._ciphertextContent || incoming.content,
    };
  }

  return {
    ...incoming,
    ...mergedIdentity,
    content: existing.content,
    _decrypted: true,
    _decryptedAttachments: existing._decryptedAttachments || [],
    _decryptionFailed: false,
    _decryptionError: null,
    _ciphertextContent: existing._ciphertextContent || incoming._ciphertextContent || incoming.content,
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

export function mergeMessagesById(existingMessages, incomingMessages) {
  const existingById = new Map((existingMessages || []).filter((message) => message?.id).map((message) => [message.id, message]));
  const incomingIds = new Set();
  const merged = (incomingMessages || []).map((message) => {
    if (message?.id) incomingIds.add(message.id);
    return preserveReadableMessage(message?.id ? existingById.get(message.id) : null, message);
  });

  for (const message of existingMessages || []) {
    if (!message?.id || incomingIds.has(message.id)) continue;
    merged.push(message);
  }

  return sortMessagesChronologically(merged);
}

export function replaceMessagesFromSnapshot(existingMessages, incomingMessages) {
  const existingById = new Map((existingMessages || []).filter((message) => message?.id).map((message) => [message.id, message]));
  const incomingIds = new Set();
  const merged = (incomingMessages || []).map((message) => {
    if (message?.id) incomingIds.add(message.id);
    return preserveReadableMessage(message?.id ? existingById.get(message.id) : null, message);
  });

  if (merged.length === 0) {
    return [];
  }

  const newestIncomingTimestamp = merged.reduce((latest, message) => (
    Math.max(latest, getMessageTimestampValue(message))
  ), Number.MIN_SAFE_INTEGER);

  for (const message of existingMessages || []) {
    if (!message?.id || incomingIds.has(message.id)) continue;
    if (getMessageTimestampValue(message) > newestIncomingTimestamp) {
      merged.push(message);
    }
  }

  return sortMessagesChronologically(merged);
}

export function appendOrReplaceMessage(existingMessages, incomingMessage) {
  if (!incomingMessage?.id) {
    return sortMessagesChronologically([...(existingMessages || []), incomingMessage]);
  }

  const incomingClientNonce = incomingMessage.client_nonce || incomingMessage._clientNonce || null;
  let replaced = false;
  const next = (existingMessages || []).map((message) => {
    const messageClientNonce = message?.client_nonce || message?._clientNonce || null;
    const matchesById = message?.id === incomingMessage.id;
    const matchesByClientNonce = Boolean(incomingClientNonce) && incomingClientNonce === messageClientNonce;
    if (!matchesById && !matchesByClientNonce) return message;
    replaced = true;
    return preserveReadableMessage(message, incomingMessage);
  });

  if (!replaced) {
    next.push(incomingMessage);
  }

  return sortMessagesChronologically(next);
}

export function prependOlderMessages(existingMessages, olderMessages) {
  const existingById = new Map((existingMessages || []).filter((message) => message?.id).map((message) => [message.id, message]));
  const olderIds = new Set();
  const mergedOlder = (olderMessages || []).map((message) => {
    if (message?.id) olderIds.add(message.id);
    return preserveReadableMessage(message?.id ? existingById.get(message.id) : null, message);
  });

  const remaining = (existingMessages || []).filter((message) => !message?.id || !olderIds.has(message.id));
  return sortMessagesChronologically([...mergedOlder, ...remaining]);
}
