import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearAllMessageCaches,
  createConversationTimestamp,
  hydrateConversationState,
  messageBelongsToConversation,
  persistReadableConversationMessages,
  resetMessageLaneState,
} from '../../../client/src/features/messaging/messageConversationStateFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('message conversation state flow clears caches and resets lane state', () => {
  const calls = [];
  const messages = createStateContainer([{ id: 'old' }]);
  const hasMore = createStateContainer(false);
  const error = createStateContainer('boom');
  const loading = createStateContainer(true);
  const messagesRef = { current: [{ id: 'old' }] };
  const prevConvRef = { current: 'room:1' };
  const pendingSentMessages = new Map([
    ['pending-1', { attachments: [{ _previewUrl: 'blob:preview' }] }],
  ]);

  resetMessageLaneState({
    pendingSentMessages,
    clearAllMessageCachesFn: () => calls.push('clear-caches'),
    revokeAttachmentPreviewUrlsFn: () => calls.push('revoke'),
    clearDeferredRoomSenderKeySyncFn: () => calls.push('clear-timeout'),
    messagesRef,
    prevConvRef,
    setMessagesFn: (nextValue) => messages.set(nextValue),
    setHasMoreFn: (nextValue) => hasMore.set(nextValue),
    setErrorFn: (nextValue) => error.set(nextValue),
    setLoadingFn: (nextValue) => loading.set(nextValue),
  });

  assert.deepEqual(calls, ['clear-caches', 'revoke', 'clear-timeout']);
  assert.equal(pendingSentMessages.size, 0);
  assert.deepEqual(messages.value, []);
  assert.equal(hasMore.value, true);
  assert.equal(error.value, '');
  assert.equal(loading.value, false);
  assert.deepEqual(messagesRef.current, []);
  assert.equal(prevConvRef.current, null);
});

test('message conversation state flow hydrates cached snapshots only when the conversation changes', () => {
  const messages = createStateContainer([]);
  const hasMore = createStateContainer(true);
  const error = createStateContainer('stale');
  const loading = createStateContainer(true);
  const messagesRef = { current: [] };
  const prevConvRef = { current: 'user-a:room:room-1' };
  const conversation = { type: 'room', id: 'room-2' };

  const first = hydrateConversationState({
    conversation,
    userId: 'user-a',
    prevConversationKey: prevConvRef.current,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    getCachedConversationStateFn: () => ({
      messages: [{ id: 'cached-message' }],
      hasMore: false,
    }),
    messagesRef,
    prevConvRef,
    setMessagesFn: (nextValue) => messages.set(nextValue),
    setHasMoreFn: (nextValue) => hasMore.set(nextValue),
    setErrorFn: (nextValue) => error.set(nextValue),
    setLoadingFn: (nextValue) => loading.set(nextValue),
  });

  assert.equal(first.changed, true);
  assert.deepEqual(messages.value, [{ id: 'cached-message' }]);
  assert.equal(hasMore.value, false);
  assert.equal(error.value, '');
  assert.equal(loading.value, false);

  const second = hydrateConversationState({
    conversation,
    userId: 'user-a',
    prevConversationKey: prevConvRef.current,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    getCachedConversationStateFn: () => {
      throw new Error('should not reload the same cache key');
    },
  });

  assert.equal(second.changed, false);
});

test('message conversation state flow persists only readable decrypted messages and preserves conversation helpers', () => {
  const persisted = [];
  const count = persistReadableConversationMessages({
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-a',
    messages: [
      { id: 'plain', encrypted: false, content: 'hello' },
      { id: 'decrypt-ok', encrypted: true, _decrypted: true, content: 'secret', _decryptedAttachments: [{ id: 'file-1' }] },
      { id: 'decrypt-missing', encrypted: true, _decrypted: false, content: 'cipher' },
    ],
    persistDecryptedMessageFn: (...args) => persisted.push(args),
  });

  assert.equal(count, 1);
  assert.equal(persisted.length, 1);
  assert.equal(messageBelongsToConversation(
    { room_id: 'room-1' },
    { type: 'room', id: 'room-1' },
    'user-a'
  ), true);
  assert.match(createConversationTimestamp(new Date('2026-03-25T21:11:12.000Z')), /^2026-03-25 21:11:12$/);
});

test('message conversation state flow clears cache layers through injected dependencies', () => {
  const calls = [];

  clearAllMessageCaches({
    clearDecryptedMessageCachesFn: ({ revokeAttachmentPreviewUrlsFn }) => {
      calls.push(['decrypted', typeof revokeAttachmentPreviewUrlsFn]);
    },
    clearConversationCacheStateFn: ({ clearConversationMessagesFn }) => {
      clearConversationMessagesFn([{ _decryptedAttachments: [{ _previewUrl: 'blob:preview' }] }]);
      calls.push(['conversation']);
    },
    clearMessageDecryptRuntimeFn: () => {
      calls.push(['decrypt-runtime']);
    },
    revokeAttachmentPreviewUrlsFn: () => {
      calls.push(['revoke']);
    },
  });

  assert.deepEqual(calls, [
    ['decrypted', 'function'],
    ['revoke'],
    ['conversation'],
    ['decrypt-runtime'],
  ]);
});
