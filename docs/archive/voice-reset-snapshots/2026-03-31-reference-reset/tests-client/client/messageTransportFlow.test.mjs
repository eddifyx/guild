import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDeleteMessageAction,
  createEditMessageAction,
  createLoadMoreMessagesAction,
} from '../../../client/src/features/messaging/messageTransportFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('message transport flow loads older history and caches it for the active conversation', async () => {
  const loading = createStateContainer(false);
  const messages = createStateContainer([
    { id: 'message-2', created_at: '2026-03-25 20:20:00' },
  ]);
  const hasMore = createStateContainer(true);
  const cached = [];

  const loadMore = createLoadMoreMessagesAction({
    conversation: { type: 'room', id: 'room-1' },
    messages: messages.value,
    loading: loading.value,
    hasMore: hasMore.value,
    userId: 'user-1',
    isConversationActiveFn: () => true,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    fetchConversationMessagesFn: async () => ({
      messages: [{ id: 'message-1', created_at: '2026-03-25 20:10:00' }],
      hasMore: false,
    }),
    prependOlderMessagesFn: (previousMessages, olderMessages) => [...olderMessages, ...previousMessages],
    cacheConversationStateFn: (...args) => cached.push(args),
    setLoadingFn: (nextValue) => loading.set(nextValue),
    setHasMoreFn: (nextValue) => hasMore.set(nextValue),
    setMessagesFn: (updater) => messages.set(updater),
    errorFn: () => {},
  });

  await loadMore();

  assert.equal(loading.value, false);
  assert.equal(hasMore.value, false);
  assert.deepEqual(messages.value.map((message) => message.id), ['message-1', 'message-2']);
  assert.equal(cached.length, 1);
});

test('message transport flow blocks editing decrypted messages and emits edits for ciphertext rows', () => {
  const warnings = [];
  const emitted = [];
  const socket = {
    emit(...args) {
      emitted.push(args);
    },
  };

  const editMessage = createEditMessageAction({
    socket,
    messages: [
      { id: 'message-1', _decrypted: true },
      { id: 'message-2', _decrypted: false },
    ],
    warnFn: (...args) => warnings.push(args),
  });

  editMessage('message-1', 'blocked');
  editMessage('message-2', 'allowed');

  assert.equal(warnings.length, 1);
  assert.deepEqual(emitted, [[
    'message:edit',
    { messageId: 'message-2', content: 'allowed' },
  ]]);
});

test('message transport flow emits deletes and warns when the server rejects them', () => {
  const warnings = [];
  const emitted = [];
  const socket = {
    emit(eventName, payload, ack) {
      emitted.push([eventName, payload]);
      ack?.({ ok: false, error: 'Denied' });
    },
  };

  const deleteMessage = createDeleteMessageAction({
    socket,
    warnFn: (...args) => warnings.push(args),
  });

  deleteMessage('message-3');

  assert.deepEqual(emitted, [[
    'message:delete',
    { messageId: 'message-3' },
  ]]);
  assert.deepEqual(warnings, [['Failed to delete message:', 'Denied']]);
});
