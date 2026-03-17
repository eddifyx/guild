import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { flushPendingControlMessagesNow, requestRoomSenderKey, syncRoomSenderKeys } from '../socket';
import { useAuth } from '../contexts/AuthContext';
import { isE2EInitialized } from '../crypto/sessionManager';
import { hasKnownNpub, rememberUserNpub } from '../crypto/identityDirectory';
import { addPerfPhase } from '../utils/devPerf';
import {
  encryptDirectMessage,
  decryptDirectMessage,
  encryptGroupMessage,
  decryptGroupMessage,
} from '../crypto/messageEncryption';

const decryptedMessageCache = new Map();
const persistedDecryptedMessageCache = new Map();
const pendingPersistedMessageLoads = new Map();
const conversationMessageCache = new Map();
const pendingSenderKeyWaits = new Map();
const reportedDecryptFailures = new Set();
const SENDER_KEY_WAIT_TIMEOUT_MS = 1500;
const PENDING_DECRYPT_VISIBLE_TIMEOUT_MS = 3000;
const MESSAGE_CACHE_TTL_MS = 10 * 60 * 1000;
const ROOM_WARM_LIMIT = 20;
const PERSISTED_MESSAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DM_UNAVAILABLE_ERROR = 'Direct messages are only available while you share a guild with this user.';

function getMessageCacheMapKey(userId, messageId) {
  return userId && messageId ? `${userId}:${messageId}` : null;
}

function hashCiphertext(ciphertext) {
  if (typeof ciphertext !== 'string') return '';
  let hash = 5381;
  for (let i = 0; i < ciphertext.length; i += 1) {
    hash = ((hash << 5) + hash) ^ ciphertext.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function isExpectedHistoricalDecryptError(err) {
  const message = err?.message || String(err || '');
  return message.includes('missing sender key state')
    || message.includes('session with ' )
    || message.includes('invalid Whisper message')
    || message.includes('untrusted identity')
    || message.includes('DuplicatedMessage')
    || message.includes('old counter')
    || (message.includes('loadPreKey') && message.includes('PreKey') && message.includes('not found'));
}

function reportDecryptFailure(msg, err, { quiet = false } = {}) {
  const key = (msg?.id || 'unknown') + ':' + (err?.message || String(err || ''));
  if (reportedDecryptFailures.has(key)) return;
  reportedDecryptFailures.add(key);
  if (quiet || isExpectedHistoricalDecryptError(err)) return;
  console.error('Decryption failed for message', msg?.id, err);
}

function evictPersistedMessageCaches(userId, messageId) {
  const mapKey = getMessageCacheMapKey(userId, messageId);
  if (!mapKey) return;
  persistedDecryptedMessageCache.delete(mapKey);
  pendingPersistedMessageLoads.delete(mapKey);
}

function deletePersistedMessageEntry(userId, messageId) {
  if (!userId || !messageId) return;
  evictPersistedMessageCaches(userId, messageId);
  if (!window.electronAPI?.messageCacheDelete) return;

  window.electronAPI.messageCacheDelete(userId, messageId).catch((err) => {
    console.warn('[Messages] Failed to delete persisted decrypted cache:', err?.message || err);
  });
}

function getCachedDecryptedMessage(msg, userId) {
  const ciphertext = msg?._ciphertextContent || msg?.content;
  if (!msg?.id || !msg?.encrypted || !ciphertext || !userId) return null;
  const cacheKey = getMessageCacheMapKey(userId, msg.id);
  const cached = cacheKey ? decryptedMessageCache.get(cacheKey) : null;
  if (!cached || cached.ciphertextHash !== hashCiphertext(ciphertext)) return null;
  return cached;
}

async function loadPersistedDecryptedMessage(msg, userId) {
  const ciphertext = msg?._ciphertextContent || msg?.content;
  if (!msg?.id || !msg?.encrypted || !ciphertext || !userId || !window.electronAPI?.messageCacheGet) return null;

  const cacheKey = getMessageCacheMapKey(userId, msg.id);
  const ciphertextHash = hashCiphertext(ciphertext);
  const cached = cacheKey ? persistedDecryptedMessageCache.get(cacheKey) : null;
  if (cached && cached.ciphertextHash === ciphertextHash) {
    decryptedMessageCache.set(cacheKey, cached);
    return cached;
  }

  if (cacheKey && pendingPersistedMessageLoads.has(cacheKey)) {
    return pendingPersistedMessageLoads.get(cacheKey);
  }

  const loadPromise = (async () => {
    try {
      const parsed = await window.electronAPI.messageCacheGet(userId, msg.id);
      if (!parsed) return null;

      if (parsed.ciphertextHash !== ciphertextHash) {
        deletePersistedMessageEntry(userId, msg.id);
        return null;
      }
      if (Date.now() - (parsed.cachedAt || 0) > PERSISTED_MESSAGE_CACHE_TTL_MS) {
        deletePersistedMessageEntry(userId, msg.id);
        return null;
      }

      if (cacheKey) {
        persistedDecryptedMessageCache.set(cacheKey, parsed);
        decryptedMessageCache.set(cacheKey, parsed);
      }
      return parsed;
    } catch (err) {
      console.warn('[Messages] Failed to load persisted decrypted cache:', err?.message || err);
      deletePersistedMessageEntry(userId, msg.id);
      return null;
    }
  })().finally(() => {
    if (cacheKey) pendingPersistedMessageLoads.delete(cacheKey);
  });

  if (cacheKey) pendingPersistedMessageLoads.set(cacheKey, loadPromise);
  return loadPromise;
}

function sanitizeCachedAttachments(attachments = []) {
  return (attachments || []).map((attachment) => {
    if (!attachment || typeof attachment !== 'object') return attachment;
    const { _previewUrl, ...rest } = attachment;
    return rest;
  });
}

function persistDecryptedMessage(msg, body, attachments = [], userId) {
  const ciphertext = msg?._ciphertextContent || msg?.content;
  if (!msg?.id || !msg?.encrypted || !ciphertext || !userId) return;

  const cachedAttachments = attachments || [];
  const persistedAttachments = sanitizeCachedAttachments(cachedAttachments);
  const entry = {
    ciphertextHash: hashCiphertext(ciphertext),
    body,
    attachments: cachedAttachments,
    cachedAt: Date.now(),
  };
  const cacheKey = getMessageCacheMapKey(userId, msg.id);
  if (cacheKey) {
    decryptedMessageCache.set(cacheKey, entry);
    persistedDecryptedMessageCache.set(cacheKey, entry);
  }

  if (!window.electronAPI?.messageCacheSet) return;

  window.electronAPI.messageCacheSet(userId, msg.id, { ...entry, attachments: persistedAttachments }).catch((err) => {
    console.warn('[Messages] Failed to persist decrypted cache:', err?.message || err);
  });
}

function getConversationCacheKey(conversation) {
  return conversation ? `${conversation.type}:${conversation.id}` : null;
}

function cloneMessages(messages) {
  return Array.isArray(messages) ? messages.map(message => ({ ...message })) : [];
}

function getCachedConversationState(conversation) {
  const key = getConversationCacheKey(conversation);
  if (!key) return null;

  const cached = conversationMessageCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > MESSAGE_CACHE_TTL_MS) {
    conversationMessageCache.delete(key);
    return null;
  }

  return {
    messages: cloneMessages(cached.messages),
    hasMore: cached.hasMore,
  };
}

function cacheConversationState(conversation, messages, hasMore) {
  const key = getConversationCacheKey(conversation);
  if (!key) return;

  conversationMessageCache.set(key, {
    messages: cloneMessages(messages),
    hasMore: !!hasMore,
    cachedAt: Date.now(),
  });
}

function updateCachedConversationState(key, updater) {
  if (!key) return;
  const existing = conversationMessageCache.get(key);
  const next = updater(existing ? { ...existing, messages: cloneMessages(existing.messages) } : null);
  if (!next) {
    conversationMessageCache.delete(key);
    return;
  }

  conversationMessageCache.set(key, {
    messages: cloneMessages(next.messages),
    hasMore: !!next.hasMore,
    cachedAt: Date.now(),
  });
}

function getAttachmentIdentity(attachment, index) {
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

function mergeDecryptedAttachments(existingAttachments = [], incomingAttachments = []) {
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

function preserveReadableMessage(existing, incoming) {
  if (!existing || !incoming || !existing._decrypted) return incoming;
  if (incoming._decrypted) {
    return {
      ...incoming,
      _decryptedAttachments: mergeDecryptedAttachments(
        existing._decryptedAttachments || [],
        incoming._decryptedAttachments || []
      ),
      _ciphertextContent: existing._ciphertextContent || incoming._ciphertextContent || incoming.content,
    };
  }

  return {
    ...incoming,
    content: existing.content,
    _decrypted: true,
    _decryptedAttachments: existing._decryptedAttachments || [],
    _decryptionFailed: false,
    _decryptionError: null,
    _ciphertextContent: existing._ciphertextContent || incoming._ciphertextContent || incoming.content,
  };
}

function createConversationTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function getMessageTimestampValue(message) {
  const raw = message?.created_at ?? message?.createdAt ?? message?.timestamp ?? null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

function sortMessagesChronologically(messages) {
  return (messages || [])
    .map((message, index) => ({ message, index }))
    .sort((a, b) => {
      const timeDelta = getMessageTimestampValue(a.message) - getMessageTimestampValue(b.message);
      if (timeDelta !== 0) return timeDelta;
      return a.index - b.index;
    })
    .map(({ message }) => message);
}

function mergeMessagesById(existingMessages, incomingMessages) {
  const existingById = new Map((existingMessages || []).filter(message => message?.id).map(message => [message.id, message]));
  const incomingIds = new Set();
  const merged = (incomingMessages || []).map(message => {
    if (message?.id) incomingIds.add(message.id);
    return preserveReadableMessage(message?.id ? existingById.get(message.id) : null, message);
  });

  for (const message of existingMessages || []) {
    if (!message?.id || incomingIds.has(message.id)) continue;
    merged.push(message);
  }

  return sortMessagesChronologically(merged);
}

function replaceMessagesFromSnapshot(existingMessages, incomingMessages) {
  const existingById = new Map((existingMessages || []).filter(message => message?.id).map(message => [message.id, message]));
  const incomingIds = new Set();
  const merged = (incomingMessages || []).map(message => {
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

function appendOrReplaceMessage(existingMessages, incomingMessage) {
  if (!incomingMessage?.id) {
    return sortMessagesChronologically([...(existingMessages || []), incomingMessage]);
  }

  const incomingClientNonce = incomingMessage.client_nonce || incomingMessage._clientNonce || null;
  let replaced = false;
  const next = (existingMessages || []).map(message => {
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

function prependOlderMessages(existingMessages, olderMessages) {
  const existingById = new Map((existingMessages || []).filter(message => message?.id).map(message => [message.id, message]));
  const olderIds = new Set();
  const mergedOlder = (olderMessages || []).map(message => {
    if (message?.id) olderIds.add(message.id);
    return preserveReadableMessage(message?.id ? existingById.get(message.id) : null, message);
  });

  const remaining = (existingMessages || []).filter(message => !message?.id || !olderIds.has(message.id));
  return sortMessagesChronologically([...mergedOlder, ...remaining]);
}

function waitForSenderKeyUpdate(roomId, timeoutMs = SENDER_KEY_WAIT_TIMEOUT_MS) {
  if (!roomId) return Promise.resolve(false);
  if (pendingSenderKeyWaits.has(roomId)) return pendingSenderKeyWaits.get(roomId);

  const promise = new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener('sender-key-updated', onUpdate);
      resolve(false);
    }, timeoutMs);

    const onUpdate = (event) => {
      if (event?.detail?.roomId !== roomId) return;
      window.clearTimeout(timeoutId);
      window.removeEventListener('sender-key-updated', onUpdate);
      resolve(true);
    };

    window.addEventListener('sender-key-updated', onUpdate);
  }).finally(() => {
    pendingSenderKeyWaits.delete(roomId);
  });

  pendingSenderKeyWaits.set(roomId, promise);
  return promise;
}

async function decryptRoomMessage(msg, userId) {
  const ciphertext = msg?._ciphertextContent || msg?.content;
  const decrypted = await decryptGroupMessage(msg.room_id, msg.sender_id, ciphertext);
  persistDecryptedMessage(msg, decrypted.body, decrypted.attachments, userId);
  return {
    ...msg,
    content: decrypted.body,
    _decrypted: true,
    _decryptedAttachments: decrypted.attachments,
    _ciphertextContent: msg._ciphertextContent || msg.content,
  };
}

async function decryptDMMessage(msg, userId) {
  const ciphertext = msg?._ciphertextContent || msg?.content;
  const decrypted = await decryptDirectMessage(msg.sender_id, ciphertext);
  persistDecryptedMessage(msg, decrypted.body, decrypted.attachments, userId);
  return {
    ...msg,
    content: decrypted.body,
    _decrypted: true,
    _decryptedAttachments: decrypted.attachments,
    _ciphertextContent: msg._ciphertextContent || msg.content,
  };
}

async function tryDecryptMessage(msg, userId, retryState = null, options = {}) {
  const ciphertext = msg?._ciphertextContent || msg?.content;
  if (!msg.encrypted || !ciphertext || !isE2EInitialized()) {
    return msg;
  }

  const cached = getCachedDecryptedMessage(msg, userId);
  if (cached) {
    return {
      ...msg,
      content: cached.body,
      _decrypted: true,
      _decryptedAttachments: cached.attachments,
      _ciphertextContent: msg._ciphertextContent || msg.content,
    };
  }

  const persisted = await loadPersistedDecryptedMessage(msg, userId);
  if (persisted) {
    return {
      ...msg,
      content: persisted.body,
      _decrypted: true,
      _decryptedAttachments: persisted.attachments,
      _ciphertextContent: msg._ciphertextContent || msg.content,
    };
  }

  if (msg.sender_npub) {
    rememberUserNpub(msg.sender_id, msg.sender_npub);
  }

  try {
    if (msg.room_id) {
      return await decryptRoomMessage(msg, userId);
    }

    return await decryptDMMessage(msg, userId);
  } catch (err) {
    if (msg.room_id && options.allowRoomSenderKeyRecovery === false) {
      return {
        ...msg,
        content: null,
        _decryptionPending: true,
        _decryptionPendingSince: msg._decryptionPendingSince || Date.now(),
        _decryptionFailed: false,
        _decryptionError: null,
        _ciphertextContent: msg._ciphertextContent || msg.content,
      };
    }

    const canRecoverRoomSenderKey = msg.room_id && (
      !retryState ||
      !(retryState.attemptedSenderIds instanceof Set && retryState.attemptedSenderIds.has(msg.sender_id))
    );
    if (canRecoverRoomSenderKey) {
      retryState?.attemptedSenderIds?.add(msg.sender_id);

      try {
        await flushPendingControlMessagesNow();
        await syncRoomSenderKeys(msg.room_id);
        await flushPendingControlMessagesNow();
        return await decryptRoomMessage(msg, userId);
      } catch (retryErr) {
        const senderKeyArrived = await waitForSenderKeyUpdate(msg.room_id);
        const recoveredFromStorage = senderKeyArrived ? false : (await syncRoomSenderKeys(msg.room_id)) > 0;
        const recoveredFromDeliveredHistory = (senderKeyArrived || recoveredFromStorage)
          ? false
          : (await syncRoomSenderKeys(msg.room_id, { includeDelivered: true, limit: 64 })) > 0;

        if (senderKeyArrived || recoveredFromStorage || recoveredFromDeliveredHistory) {
          try {
            await flushPendingControlMessagesNow();
            return await decryptRoomMessage(msg, userId);
          } catch (finalErr) {
            err = finalErr;
          }
        } else {
          const requestedResend = await requestRoomSenderKey(msg.room_id, msg.sender_id);
          if (requestedResend) {
            const resentKeyArrived = await waitForSenderKeyUpdate(msg.room_id);
            const resentRecoveredFromStorage = resentKeyArrived ? false : (await syncRoomSenderKeys(msg.room_id)) > 0;
            if (resentKeyArrived || resentRecoveredFromStorage) {
              try {
                await flushPendingControlMessagesNow();
                return await decryptRoomMessage(msg, userId);
              } catch (finalErr) {
                err = finalErr;
              }
            } else {
              err = retryErr;
            }
          } else {
            err = retryErr;
          }
        }
      }
    }

    const persistedFallback = await loadPersistedDecryptedMessage(msg, userId);
    if (persistedFallback) {
      return {
        ...msg,
        content: persistedFallback.body,
        _decrypted: true,
        _decryptedAttachments: persistedFallback.attachments,
        _ciphertextContent: msg._ciphertextContent || msg.content,
      };
    }
    reportDecryptFailure(msg, err, options);
    return {
      ...msg,
      content: null,
      _decryptionFailed: true,
      _decryptionError: 'Decryption failed',
      _ciphertextContent: msg._ciphertextContent || msg.content,
    };
  }
}

async function decryptMessages(msgs, userId, options = {}) {
  const results = [];
  const roomRetryStates = new Map();

  for (const msg of msgs) {
    let retryState = null;
    if (msg.room_id) {
      retryState = roomRetryStates.get(msg.room_id);
      if (!retryState) {
        retryState = { attemptedSenderIds: new Set() };
        roomRetryStates.set(msg.room_id, retryState);
      }
    }

    results.push(await tryDecryptMessage(msg, userId, retryState, options));
  }

  return results;
}

async function fetchConversationMessages(
  conversation,
  userId,
  { before = null, limit = 50, quietDecrypt = false, fastRoomOpen = false } = {},
) {
  if (!conversation) {
    return { messages: [], hasMore: false };
  }

  let roomSenderKeySyncPromise = null;
  if (conversation.type === 'room') {
    roomSenderKeySyncPromise = (async () => {
      await syncRoomSenderKeys(conversation.id);
      await flushPendingControlMessagesNow();
    })().catch((err) => {
      console.warn('[Rooms] Sender-key sync failed while opening room:', err?.message || err);
    });
    if (!fastRoomOpen) {
      await roomSenderKeySyncPromise;
    }
  }

  const beforeQuery = before ? `?before=${encodeURIComponent(before)}&limit=${limit}` : `?limit=${limit}`;
  const url = conversation.type === 'room'
    ? `/api/messages/room/${conversation.id}${beforeQuery}`
    : `/api/messages/dm/${conversation.id}${beforeQuery}`;

  const msgs = await api(url);

  const decrypted = await decryptMessages(msgs, userId, {
    quiet: quietDecrypt,
    allowRoomSenderKeyRecovery: !(conversation.type === 'room' && fastRoomOpen),
  });
  return {
    messages: sortMessagesChronologically(decrypted),
    hasMore: msgs.length >= limit,
    roomSenderKeySyncPromise,
  };
}

export async function warmRoomMessageCache(rooms, userId) {
  if (!Array.isArray(rooms) || rooms.length === 0 || !userId || !isE2EInitialized()) return;

  const roomsToWarm = rooms.filter((room) => !getCachedConversationState({ type: 'room', id: room.id }));
  const concurrency = Math.min(4, roomsToWarm.length);

  const warmNext = async (index) => {
    const room = roomsToWarm[index];
    if (!room) return;

    const conversation = { type: 'room', id: room.id };
    try {
      const { messages, hasMore } = await fetchConversationMessages(conversation, userId, {
        limit: ROOM_WARM_LIMIT,
        quietDecrypt: true,
      });
      cacheConversationState(conversation, messages, hasMore);
    } catch (err) {
      console.warn('[Rooms] Failed to warm room cache for', room?.name || room?.id, err?.message || err);
    }

    await warmNext(index + concurrency);
  };

  await Promise.all(Array.from({ length: concurrency }, (_, index) => warmNext(index)));
}

export function useMessages(conversation, perfTraceId = null) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const prevConvRef = useRef(null);
  const pendingSentMessagesRef = useRef(new Map());
  const messagesRef = useRef([]);
  const retryFailedVisibleRoomMessagesRef = useRef(async () => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const key = getConversationCacheKey(conversation);
    const prevKey = prevConvRef.current;
    if (key !== prevKey) {
      const cached = getCachedConversationState(conversation);
      setMessages(cached?.messages || []);
      setHasMore(cached?.hasMore ?? true);
      setError('');
      setLoading(false);
      prevConvRef.current = key;
    }
  }, [conversation]);

  const reloadMessages = useCallback(async () => {
    if (!conversation) return;

    const convKey = `${conversation.type}:${conversation.id}`;
    if (conversation.type === 'dm' && conversation.dmUnsupported) {
      conversationMessageCache.delete(convKey);
      if (prevConvRef.current === convKey) {
        setMessages([]);
        setHasMore(false);
        setError(DM_UNAVAILABLE_ERROR);
        setLoading(false);
      }
      return;
    }

    const shouldShowInitialLoader = messagesRef.current.length === 0;
    if (shouldShowInitialLoader) {
      setLoading(true);
    }
    try {
      const useFastRoomOpen = conversation.type === 'room' && messagesRef.current.length === 0;
      addPerfPhase(perfTraceId, 'messages:reload-start', {
        cachedMessageCount: messagesRef.current.length,
        fastRoomOpen: useFastRoomOpen,
      });
      const {
        messages: decrypted,
        hasMore: nextHasMore,
        roomSenderKeySyncPromise,
      } = await fetchConversationMessages(conversation, user?.userId, {
        limit: 50,
        fastRoomOpen: useFastRoomOpen,
      });
      if (prevConvRef.current !== convKey) return;
      setError('');
      setHasMore(nextHasMore);
      setMessages(prev => {
        const next = conversation.type === 'room'
          ? replaceMessagesFromSnapshot(prev, decrypted)
          : mergeMessagesById(prev, decrypted);
        cacheConversationState(conversation, next, nextHasMore);
        return next;
      });
      addPerfPhase(perfTraceId, 'messages:reload-ready', {
        fetchedMessageCount: decrypted.length,
        hasMore: nextHasMore,
      });
      if (useFastRoomOpen && roomSenderKeySyncPromise) {
        void roomSenderKeySyncPromise.finally(() => {
          addPerfPhase(perfTraceId, 'messages:sender-key-sync-finished');
          if (prevConvRef.current === convKey) {
            void retryFailedVisibleRoomMessagesRef.current();
          }
        });
      }
    } catch (err) {
      addPerfPhase(perfTraceId, 'messages:reload-error', {
        error: err?.message || 'Failed to fetch messages',
      });
      if (prevConvRef.current === convKey) {
        setError(err?.message || 'Failed to fetch messages.');
        console.error('Failed to fetch messages:', err);
      }
    }
    if (prevConvRef.current === convKey) {
      setLoading(false);
    }
  }, [conversation, user?.userId, perfTraceId]);

  const retryFailedVisibleMessages = useCallback(async () => {
    if (!conversation || !user?.userId) return;

    const failedMessages = messagesRef.current.filter(message => {
      if (!message?.encrypted || (!message?._decryptionFailed && !message?._decryptionPending)) return false;
      if (conversation.type === 'room') {
        return message?.room_id === conversation.id;
      }
      if (conversation.type === 'dm') {
        return !message?.room_id && (
          (message?.sender_id === conversation.id && message?.dm_partner_id === user.userId) ||
          (message?.sender_id === user.userId && message?.dm_partner_id === conversation.id)
        );
      }
      return false;
    });

    if (failedMessages.length === 0) return;

    const retriedById = new Map();
    const roomRetryStates = new Map();
    for (const message of failedMessages) {
      let retryState = null;
      if (conversation.type === 'room') {
        retryState = roomRetryStates.get(message.room_id);
        if (!retryState) {
          retryState = { attemptedSenderIds: new Set() };
          roomRetryStates.set(message.room_id, retryState);
        }
      }
      const retried = await tryDecryptMessage(message, user.userId, retryState, { quiet: true });
      const resolvedToVisibleState = retried?._decrypted
        || retried?._decryptionFailed
        || (typeof retried?.content === 'string' && retried.content.length > 0);

      if (resolvedToVisibleState) {
        retriedById.set(message.id, retried);
      }
    }

    if (retriedById.size === 0) return;
    if (prevConvRef.current !== `${conversation.type}:${conversation.id}`) return;

    setMessages(prev => {
      let changed = false;
      const next = prev.map(message => {
        const replacement = message?.id ? retriedById.get(message.id) : null;
        if (!replacement) return message;
        changed = true;
        return replacement;
      });

      if (!changed) return prev;
      cacheConversationState(conversation, next, hasMore);
      return next;
    });
  }, [conversation, user?.userId, hasMore]);

  const retryFailedVisibleRoomMessages = useCallback(async () => {
    if (!conversation || conversation.type !== 'room') return;
    await retryFailedVisibleMessages();
  }, [conversation, retryFailedVisibleMessages]);

  useEffect(() => {
    retryFailedVisibleRoomMessagesRef.current = retryFailedVisibleRoomMessages;
  }, [retryFailedVisibleRoomMessages]);

  useEffect(() => {
    if (!conversation || conversation.type !== 'room') return;

    const handleSenderKeyUpdated = (event) => {
      if (event?.detail?.roomId !== conversation.id) return;
      retryFailedVisibleRoomMessages();
    };

    window.addEventListener('sender-key-updated', handleSenderKeyUpdated);
    return () => window.removeEventListener('sender-key-updated', handleSenderKeyUpdated);
  }, [conversation, retryFailedVisibleRoomMessages]);

  useEffect(() => {
    if (!conversation || conversation.type !== 'room' || !user?.userId) return;
    const hasPendingRoomMessages = messages.some((message) => (
      message?.room_id === conversation.id
      && message?.encrypted
      && message?._decryptionPending
    ));
    if (!hasPendingRoomMessages) return;

    const timeoutId = window.setTimeout(() => {
      retryFailedVisibleRoomMessages();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [conversation, messages, user?.userId, retryFailedVisibleRoomMessages]);

  useEffect(() => {
    if (!conversation || conversation.type !== 'room') return;

    const now = Date.now();
    const pendingMessages = messages.filter((message) => (
      message?.room_id === conversation.id
      && message?.encrypted
      && message?._decryptionPending
    ));
    if (pendingMessages.length === 0) return;

    const nextExpiryMs = pendingMessages.reduce((soonest, message) => {
      const pendingSince = message?._decryptionPendingSince || now;
      const expiresIn = Math.max(0, PENDING_DECRYPT_VISIBLE_TIMEOUT_MS - (now - pendingSince));
      return Math.min(soonest, expiresIn);
    }, PENDING_DECRYPT_VISIBLE_TIMEOUT_MS);

    const timeoutId = window.setTimeout(() => {
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((message) => {
          if (
            message?.room_id !== conversation.id
            || !message?.encrypted
            || !message?._decryptionPending
          ) {
            return message;
          }

          const pendingSince = message?._decryptionPendingSince || now;
          if (Date.now() - pendingSince < PENDING_DECRYPT_VISIBLE_TIMEOUT_MS) {
            return message;
          }

          changed = true;
          return {
            ...message,
            _decryptionPending: false,
            _decryptionFailed: true,
            _decryptionError: 'Decryption failed',
          };
        });

        if (!changed) return prev;
        cacheConversationState(conversation, next, hasMore);
        return next;
      });
    }, nextExpiryMs);

    return () => window.clearTimeout(timeoutId);
  }, [conversation, messages, hasMore]);

  useEffect(() => {
    if (!conversation || conversation.type !== 'dm' || !user?.userId) return;
    const hasFailedMessages = messages.some(message => message?.encrypted && message?._decryptionFailed);
    if (!hasFailedMessages) return;

    const hasReadableMessages = messages.some(message => (
      !message?._decryptionFailed &&
      (
        !message?.encrypted ||
        message?._decrypted ||
        (typeof message?.content === 'string' && message.content.length > 0)
      )
    ));
    if (!hasReadableMessages) return;

    retryFailedVisibleMessages();
  }, [conversation, messages, user?.userId, retryFailedVisibleMessages]);

  useEffect(() => {
    if (!conversation) return;
    reloadMessages();
  }, [conversation, reloadMessages]);

  useEffect(() => {
    if (!socket || !conversation) return;

    if (conversation.type === 'room') {
      const handler = async (msg) => {
        if (msg.room_id !== conversation.id) return;

        if (msg.encrypted && msg.sender_id === user?.userId) {
          const pending = msg.client_nonce ? pendingSentMessagesRef.current.get(msg.client_nonce) : null;
          if (pending) {
            pendingSentMessagesRef.current.delete(msg.client_nonce);
            persistDecryptedMessage(msg, pending.content, pending.attachments, user?.userId);
            setMessages(prev => {
              const next = appendOrReplaceMessage(prev, {
                ...msg,
                content: pending.content,
                _decrypted: true,
                _decryptedAttachments: pending.attachments,
                _ciphertextContent: msg.content,
                _clientNonce: msg.client_nonce || pending.clientNonce || null,
              });
              updateCachedConversationState(getConversationCacheKey(conversation), cached => ({
                messages: next,
                hasMore: cached?.hasMore ?? hasMore,
              }));
              return next;
            });
            return;
          }
        }

        const decrypted = await tryDecryptMessage(msg, user?.userId);
        setMessages(prev => {
          const next = appendOrReplaceMessage(prev, decrypted);
          updateCachedConversationState(getConversationCacheKey(conversation), cached => ({
            messages: next,
            hasMore: cached?.hasMore ?? hasMore,
          }));
          return next;
        });
      };

      socket.on('room:message', handler);
      return () => socket.off('room:message', handler);
    }

    const handler = async (msg) => {
      const isThisDM =
        (msg.sender_id === conversation.id && msg.dm_partner_id === user?.userId) ||
        (msg.sender_id === user?.userId && msg.dm_partner_id === conversation.id);
      if (!isThisDM) return;

      if (msg.encrypted && msg.sender_id === user?.userId) {
        const pending = msg.client_nonce ? pendingSentMessagesRef.current.get(msg.client_nonce) : null;
        if (pending) {
          pendingSentMessagesRef.current.delete(msg.client_nonce);
          setMessages(prev => {
            persistDecryptedMessage(msg, pending.content, pending.attachments, user?.userId);
            const next = appendOrReplaceMessage(prev, {
              ...msg,
              content: pending.content,
              _decrypted: true,
              _decryptedAttachments: pending.attachments,
              _ciphertextContent: msg.content,
              _clientNonce: msg.client_nonce || pending.clientNonce || null,
            });
            updateCachedConversationState(getConversationCacheKey(conversation), cached => ({
              messages: next,
              hasMore: cached?.hasMore ?? hasMore,
            }));
            return next;
          });
          return;
        }
      }

      const decrypted = await tryDecryptMessage(msg, user?.userId);
      setMessages(prev => {
        const next = appendOrReplaceMessage(prev, decrypted);
        updateCachedConversationState(getConversationCacheKey(conversation), cached => ({
          messages: next,
          hasMore: cached?.hasMore ?? hasMore,
        }));
        return next;
      });
    };

    socket.on('dm:message', handler);
    return () => socket.off('dm:message', handler);
  }, [socket, conversation, hasMore, user?.userId, user?.username, user?.avatarColor, user?.profilePicture, user?.npub]);

  useEffect(() => {
    if (!conversation || !user?.userId || messages.length === 0) return;

    for (const message of messages) {
      if (!message?.encrypted || !message?._decrypted || typeof message.content !== 'string') continue;
      persistDecryptedMessage(message, message.content, message._decryptedAttachments || [], user.userId);
    }
  }, [conversation, messages, user?.userId]);

  useEffect(() => {
    if (!socket) return;

    const handleEdited = ({ messageId, content, edited_at }) => {
      setMessages(prev => {
        const next = prev.map(m => {
          if (m.id !== messageId) return m;
          if (m._decrypted) return { ...m, edited_at };
          return { ...m, content, edited_at };
        });
        updateCachedConversationState(getConversationCacheKey(conversation), cached => cached ? {
          messages: next,
          hasMore: cached.hasMore,
        } : null);
        return next;
      });
    };

    const handleDeleted = ({ messageId }) => {
      deletePersistedMessageEntry(user?.userId, messageId);
      setMessages(prev => {
        const next = prev.filter(m => m.id !== messageId);
        updateCachedConversationState(getConversationCacheKey(conversation), cached => cached ? {
          messages: next,
          hasMore: cached.hasMore,
        } : null);
        return next;
      });
    };

    socket.on('message:edited', handleEdited);
    socket.on('message:deleted', handleDeleted);
    return () => {
      socket.off('message:edited', handleEdited);
      socket.off('message:deleted', handleDeleted);
    };
  }, [socket]);

  const sendMessage = useCallback(async (content, attachments = null) => {
    if (!socket || !conversation) return;
    if (conversation.type === 'dm' && conversation.dmUnsupported) {
      throw new Error(DM_UNAVAILABLE_ERROR);
    }
    if (!isE2EInitialized()) {
      throw new Error('End-to-end encryption is not ready yet. Messages stay locked until secure startup succeeds.');
    }
    if (conversation.type === 'dm' && !hasKnownNpub(conversation.id)) {
      throw new Error('Secure messaging is waiting for this contact\'s Nostr identity.');
    }

    let encryptedAttachmentMeta = null;
    let attachmentRefs = null;
    if (attachments && attachments.length > 0) {
      const unencrypted = attachments.filter(a => !a._encrypted);
      if (unencrypted.length > 0) {
        throw new Error(`Cannot send ${unencrypted.length} unencrypted attachment(s) while secure messaging is active.`);
      }
      const missingUploads = attachments.filter(a => !a.fileId);
      if (missingUploads.length > 0) {
        throw new Error('One or more attachments lost their upload reference. Re-upload and try again.');
      }
      const localAttachmentMeta = attachments.map(a => ({
        serverFileUrl: a.fileUrl || a.file_url,
        encryptionKey: a._encryptionKey,
        encryptionDigest: a._encryptionDigest,
        originalFileName: a._originalName,
        originalFileType: a._originalType,
        originalFileSize: a._originalSize,
        _previewUrl: a._previewUrl || null,
      }));
      encryptedAttachmentMeta = localAttachmentMeta.map(({ _previewUrl, ...persistableAttachment }) => persistableAttachment);
      attachmentRefs = attachments.map(a => ({ fileId: a.fileId }));
    }

    const emitWithAck = (eventName, payload) => new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new Error('Secure send timed out. Try again.'));
      }, 10000);

      socket.emit(eventName, payload, (response) => {
        window.clearTimeout(timeoutId);
        if (response?.ok) {
          resolve(response);
          return;
        }
        reject(new Error(response?.error || 'Secure send failed.'));
      });
    });

    const clientNonce = window.crypto?.randomUUID?.()
      || `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const conversationKey = getConversationCacheKey(conversation);
    const pendingEntry = {
      clientNonce,
      content,
      attachments: attachments && attachments.length > 0
        ? attachments.map(a => ({
            serverFileUrl: a.fileUrl || a.file_url,
            encryptionKey: a._encryptionKey,
            encryptionDigest: a._encryptionDigest,
            originalFileName: a._originalName,
            originalFileType: a._originalType,
            originalFileSize: a._originalSize,
            _previewUrl: a._previewUrl || null,
          }))
        : encryptedAttachmentMeta,
    };
    const optimisticMessage = {
      id: `optimistic:${clientNonce}`,
      client_nonce: clientNonce,
      _clientNonce: clientNonce,
      content,
      sender_id: user?.userId,
      sender_name: user?.username || 'You',
      sender_color: user?.avatarColor || '#40FF40',
      sender_picture: user?.profilePicture || null,
      sender_npub: user?.npub || null,
      room_id: conversation.type === 'room' ? conversation.id : null,
      dm_partner_id: conversation.type === 'dm' ? conversation.id : null,
      attachments: [],
      created_at: createConversationTimestamp(),
      encrypted: 1,
      _decrypted: true,
      _decryptedAttachments: pendingEntry.attachments,
      _optimistic: true,
    };

    pendingSentMessagesRef.current.set(clientNonce, pendingEntry);
    setMessages(prev => {
      const next = appendOrReplaceMessage(prev, optimisticMessage);
      updateCachedConversationState(conversationKey, cached => ({
        messages: next,
        hasMore: cached?.hasMore ?? hasMore,
      }));
      return next;
    });

    try {
      if (conversation.type === 'room') {
        const encrypted = await encryptGroupMessage(conversation.id, content, encryptedAttachmentMeta);
        const response = await emitWithAck('room:message', {
          roomId: conversation.id,
          content: encrypted,
          attachments: attachmentRefs,
          encrypted: true,
          clientNonce,
        });
        if (response?.messageId) {
          pendingSentMessagesRef.current.delete(clientNonce);
          persistDecryptedMessage({ id: response.messageId, encrypted: true, content: encrypted }, content, pendingEntry.attachments, user?.userId);
          const finalizedMessage = {
            ...optimisticMessage,
            id: response.messageId,
            _optimistic: false,
            _ciphertextContent: encrypted,
          };
          updateCachedConversationState(conversationKey, cached => ({
            messages: appendOrReplaceMessage(cached?.messages || [], finalizedMessage),
            hasMore: cached?.hasMore ?? hasMore,
          }));
          if (prevConvRef.current === conversationKey) {
            setMessages(prev => appendOrReplaceMessage(prev, finalizedMessage));
          }
        }
        return;
      }

      const encrypted = await encryptDirectMessage(conversation.id, content, encryptedAttachmentMeta);
      const response = await emitWithAck('dm:message', {
        toUserId: conversation.id,
        content: encrypted,
        attachments: attachmentRefs,
        encrypted: true,
        clientNonce,
      });
      if (response?.messageId) {
        pendingSentMessagesRef.current.delete(clientNonce);
        persistDecryptedMessage({ id: response.messageId, encrypted: true, content: encrypted }, content, pendingEntry.attachments, user?.userId);
        const finalizedMessage = {
          ...optimisticMessage,
          id: response.messageId,
          _optimistic: false,
          _ciphertextContent: encrypted,
        };
        updateCachedConversationState(conversationKey, cached => ({
          messages: appendOrReplaceMessage(cached?.messages || [], finalizedMessage),
          hasMore: cached?.hasMore ?? hasMore,
        }));
        if (prevConvRef.current === conversationKey) {
          setMessages(prev => appendOrReplaceMessage(prev, finalizedMessage));
        }
      }
    } catch (err) {
      pendingSentMessagesRef.current.delete(clientNonce);
      updateCachedConversationState(conversationKey, cached => cached ? {
        messages: cached.messages.filter((message) => (
          (message?.client_nonce || message?._clientNonce || null) !== clientNonce
        )),
        hasMore: cached.hasMore,
      } : null);
      if (prevConvRef.current === conversationKey) {
        setMessages(prev => prev.filter((message) => (
          (message?.client_nonce || message?._clientNonce || null) !== clientNonce
        )));
      }
      throw err;
    }
  }, [socket, conversation, hasMore, user?.userId, user?.username, user?.avatarColor, user?.profilePicture, user?.npub]);

  const loadMore = useCallback(async () => {
    if (!conversation || !messages.length || loading || !hasMore) return;

    const convKey = `${conversation.type}:${conversation.id}`;
    const oldest = messages[0];
    setLoading(true);
    try {
      const { messages: decrypted, hasMore: nextHasMore } = await fetchConversationMessages(conversation, user?.userId, {
        before: oldest.created_at,
        limit: 50,
      });
      if (prevConvRef.current !== convKey) return;
      setHasMore(nextHasMore);
      setMessages(prev => {
        const next = prependOlderMessages(prev, decrypted);
        cacheConversationState(conversation, next, nextHasMore);
        return next;
      });
    } catch (err) {
      console.error('Failed to load more messages:', err);
    }
    if (prevConvRef.current === convKey) setLoading(false);
  }, [conversation, messages, loading, hasMore, user?.userId]);

  const editMessage = useCallback((messageId, content) => {
    if (!socket) return;
    const msg = messages.find(m => m.id === messageId);
    if (msg && msg._decrypted) {
      console.warn('Editing encrypted messages is not supported');
      return;
    }
    socket.emit('message:edit', { messageId, content });
  }, [socket, messages]);

  const deleteMessage = useCallback((messageId) => {
    if (!socket) return;
    socket.emit('message:delete', { messageId }, (response) => {
      if (response?.ok) return;
      console.warn('Failed to delete message:', response?.error || 'Unknown delete failure');
    });
  }, [socket]);

  return { messages, loading, hasMore, error, sendMessage, loadMore, editMessage, deleteMessage };
}
