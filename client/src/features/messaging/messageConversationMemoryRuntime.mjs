import {
  cloneMessages,
  getConversationCacheKey,
  MESSAGE_CACHE_TTL_MS,
} from './messageConversationCacheModel.mjs';
import {
  getPersistedConversationState,
  persistConversationState,
} from './messageConversationSnapshotRuntime.mjs';

const conversationMessageCache = new Map();

export function getCachedConversationState(
  conversation,
  userId,
  {
    storage,
    nowFn = Date.now,
    messageCacheTtlMs = MESSAGE_CACHE_TTL_MS,
  } = {},
) {
  const key = getConversationCacheKey(conversation, userId);
  if (!key) return null;

  const cached = conversationMessageCache.get(key);
  if (cached) {
    if (nowFn() - cached.cachedAt > messageCacheTtlMs) {
      conversationMessageCache.delete(key);
    } else {
      return {
        messages: cloneMessages(cached.messages),
        hasMore: cached.hasMore,
      };
    }
  }

  return getPersistedConversationState(conversation, userId, { storage, nowFn });
}

export function cacheConversationState(
  conversation,
  messages,
  hasMore,
  userId,
  {
    storage,
    nowFn = Date.now,
    sortMessagesChronologicallyFn,
  } = {},
) {
  const key = getConversationCacheKey(conversation, userId);
  if (!key) return;

  conversationMessageCache.set(key, {
    messages: cloneMessages(messages),
    hasMore: !!hasMore,
    cachedAt: nowFn(),
  });
  persistConversationState(conversation, messages, hasMore, userId, {
    storage,
    nowFn,
    sortMessagesChronologicallyFn,
  });
}

export function updateCachedConversationState(key, updater, { nowFn = Date.now } = {}) {
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
    cachedAt: nowFn(),
  });
}

export function clearConversationCacheState({ clearConversationMessagesFn } = {}) {
  if (typeof clearConversationMessagesFn === 'function') {
    for (const cached of conversationMessageCache.values()) {
      clearConversationMessagesFn(cached?.messages);
    }
  }
  conversationMessageCache.clear();
}
