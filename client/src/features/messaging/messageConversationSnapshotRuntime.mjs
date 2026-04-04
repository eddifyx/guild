import {
  cloneMessages,
  getConversationCacheKey,
  PERSISTED_CONVERSATION_MESSAGE_LIMIT,
  PERSISTED_CONVERSATION_SNAPSHOT_KEY,
  PERSISTED_CONVERSATION_SNAPSHOT_LIMIT,
  PERSISTED_CONVERSATION_SNAPSHOT_TTL_MS,
  sanitizeMessageForSnapshot,
  sortMessagesChronologically,
} from './messageConversationCacheModel.mjs';

function getSnapshotStorage(storage) {
  if (storage) return storage;
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function loadPersistedConversationSnapshots({
  storage,
  storageKey = PERSISTED_CONVERSATION_SNAPSHOT_KEY,
} = {}) {
  const snapshotStorage = getSnapshotStorage(storage);
  if (!snapshotStorage) return {};

  try {
    const raw = snapshotStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function savePersistedConversationSnapshots(
  nextSnapshots,
  {
    storage,
    storageKey = PERSISTED_CONVERSATION_SNAPSHOT_KEY,
  } = {},
) {
  const snapshotStorage = getSnapshotStorage(storage);
  if (!snapshotStorage) return;

  try {
    snapshotStorage.setItem(storageKey, JSON.stringify(nextSnapshots));
  } catch {}
}

export function getPersistedConversationState(
  conversation,
  userId,
  {
    storage,
    nowFn = Date.now,
    storageKey = PERSISTED_CONVERSATION_SNAPSHOT_KEY,
    snapshotTtlMs = PERSISTED_CONVERSATION_SNAPSHOT_TTL_MS,
  } = {},
) {
  const key = getConversationCacheKey(conversation, userId);
  if (!key || conversation?.type !== 'room') return null;

  const snapshots = loadPersistedConversationSnapshots({ storage, storageKey });
  const snapshot = snapshots[key];
  if (!snapshot || typeof snapshot !== 'object') return null;
  if (nowFn() - (snapshot.cachedAt || 0) > snapshotTtlMs) {
    delete snapshots[key];
    savePersistedConversationSnapshots(snapshots, { storage, storageKey });
    return null;
  }

  return {
    messages: cloneMessages(snapshot.messages),
    hasMore: !!snapshot.hasMore,
  };
}

export function persistConversationState(
  conversation,
  messages,
  hasMore,
  userId,
  {
    storage,
    nowFn = Date.now,
    storageKey = PERSISTED_CONVERSATION_SNAPSHOT_KEY,
    snapshotLimit = PERSISTED_CONVERSATION_SNAPSHOT_LIMIT,
    messageLimit = PERSISTED_CONVERSATION_MESSAGE_LIMIT,
    sortMessagesChronologicallyFn = sortMessagesChronologically,
  } = {},
) {
  const key = getConversationCacheKey(conversation, userId);
  if (!key || conversation?.type !== 'room') return;

  const sanitizedMessages = sortMessagesChronologicallyFn(messages)
    .slice(-messageLimit)
    .map(sanitizeMessageForSnapshot)
    .filter(Boolean);

  const snapshots = loadPersistedConversationSnapshots({ storage, storageKey });
  snapshots[key] = {
    cachedAt: nowFn(),
    hasMore: !!hasMore,
    messages: sanitizedMessages,
  };

  const prunedEntries = Object.entries(snapshots)
    .filter(([, snapshot]) => snapshot && typeof snapshot === 'object')
    .sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))
    .slice(0, snapshotLimit);

  savePersistedConversationSnapshots(Object.fromEntries(prunedEntries), { storage, storageKey });
}
