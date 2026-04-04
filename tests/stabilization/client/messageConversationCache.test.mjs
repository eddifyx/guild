import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cacheConversationState,
  clearConversationCacheState,
  getCachedConversationState,
  getConversationCacheKey,
  getPersistedConversationState,
  loadPersistedConversationSnapshots,
  persistConversationState,
  updateCachedConversationState,
} from '../../../client/src/features/messaging/messageConversationCache.mjs';

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('message conversation cache builds stable cache keys per user and conversation', () => {
  assert.equal(getConversationCacheKey({ type: 'room', id: 'room-1' }, 'user-a'), 'user-a:room:room-1');
  assert.equal(getConversationCacheKey({ type: 'dm', id: 'user-b' }, 'user-a'), 'user-a:dm:user-b');
  assert.equal(getConversationCacheKey(null, 'user-a'), null);
});

test('message conversation cache stores memory snapshots and falls back to persisted room snapshots', () => {
  const storage = createMemoryStorage();
  const conversation = { type: 'room', id: 'room-1' };
  const messages = [
    { id: 'msg-1', created_at: '2026-01-01 00:00:00', content: 'hello' },
  ];

  clearConversationCacheState();
  cacheConversationState(conversation, messages, true, 'user-a', { storage, nowFn: () => 1000 });

  const cached = getCachedConversationState(conversation, 'user-a', { storage, nowFn: () => 1001 });
  assert.deepEqual(cached, { messages, hasMore: true });

  clearConversationCacheState();
  const persisted = getCachedConversationState(conversation, 'user-a', { storage, nowFn: () => 1002 });
  assert.equal(persisted.hasMore, true);
  assert.equal(persisted.messages[0].id, 'msg-1');
  assert.equal(persisted.messages[0].content, 'hello');
  assert.equal(persisted.messages[0].created_at, '2026-01-01 00:00:00');
  assert.equal(persisted.messages[0]._decryptionFailed, false);
  assert.deepEqual(persisted.messages[0]._decryptedAttachments, []);
});

test('message conversation cache prunes expired persisted room snapshots', () => {
  const storage = createMemoryStorage();
  const conversation = { type: 'room', id: 'room-1' };

  persistConversationState(conversation, [{ id: 'msg-1', created_at: '2026-01-01 00:00:00' }], false, 'user-a', {
    storage,
    nowFn: () => 1000,
  });

  const expired = getPersistedConversationState(conversation, 'user-a', {
    storage,
    nowFn: () => 1000 + (24 * 60 * 60 * 1000) + 1,
  });
  assert.equal(expired, null);
  assert.deepEqual(loadPersistedConversationSnapshots({ storage }), {});
});

test('message conversation cache persists sorted, limited room snapshots and updates in-memory state', () => {
  const storage = createMemoryStorage();
  const conversation = { type: 'room', id: 'room-1' };

  persistConversationState(conversation, [
    { id: 'msg-2', created_at: '2026-01-02 00:00:00', content: 'later' },
    { id: 'msg-1', created_at: '2026-01-01 00:00:00', content: 'earlier' },
  ], true, 'user-a', {
    storage,
    nowFn: () => 1000,
  });

  const snapshots = loadPersistedConversationSnapshots({ storage });
  assert.deepEqual(
    snapshots['user-a:room:room-1'].messages.map((message) => message.id),
    ['msg-1', 'msg-2']
  );

  clearConversationCacheState();
  cacheConversationState(conversation, [{ id: 'msg-1' }], false, 'user-a', { storage, nowFn: () => 2000 });
  updateCachedConversationState('user-a:room:room-1', (existing) => ({
    ...existing,
    hasMore: true,
    messages: [...existing.messages, { id: 'msg-2' }],
  }), { nowFn: () => 2001 });

  const cached = getCachedConversationState(conversation, 'user-a', { storage, nowFn: () => 2002 });
  assert.deepEqual(cached, {
    hasMore: true,
    messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
  });
});

test('message conversation cache cleanup invokes message cleanup hooks before clearing memory', () => {
  const storage = createMemoryStorage();
  const conversation = { type: 'room', id: 'room-1' };
  const cleaned = [];

  cacheConversationState(conversation, [{ id: 'msg-1' }], false, 'user-a', { storage, nowFn: () => 1000 });
  clearConversationCacheState({
    clearConversationMessagesFn(messages) {
      cleaned.push(messages.map((message) => message.id));
    },
  });

  assert.deepEqual(cleaned, [['msg-1']]);
  assert.equal(getCachedConversationState(conversation, 'user-a', { storage: null, nowFn: () => 1001 }), null);
});
