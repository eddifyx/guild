import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDeletedConversationMessage,
  applyEditedConversationMessage,
  isIncomingMessageForConversation,
  processIncomingConversationMessage,
} from '../../../client/src/features/messaging/messageRealtimeFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('message realtime flow matches room and DM messages to the active conversation', () => {
  assert.equal(
    isIncomingMessageForConversation(
      { room_id: 'room-1' },
      { type: 'room', id: 'room-1' },
      'user-1'
    ),
    true
  );

  assert.equal(
    isIncomingMessageForConversation(
      { sender_id: 'user-2', dm_partner_id: 'user-1' },
      { type: 'dm', id: 'user-2' },
      'user-1'
    ),
    true
  );

  assert.equal(
    isIncomingMessageForConversation(
      { sender_id: 'user-3', dm_partner_id: 'user-1' },
      { type: 'dm', id: 'user-2' },
      'user-1'
    ),
    false
  );
});

test('message realtime flow finalizes optimistic pending messages from the current user', async () => {
  const messages = createStateContainer([]);
  const pendingSentMessages = new Map([
    ['nonce-1', { clientNonce: 'nonce-1', content: 'hello', attachments: [{ _previewUrl: 'blob:1', name: 'file' }] }],
  ]);
  const cachedStates = [];
  const persisted = [];
  const revoked = [];

  const result = await processIncomingConversationMessage({
    message: {
      id: 'server-1',
      client_nonce: 'nonce-1',
      sender_id: 'user-1',
      room_id: 'room-1',
      encrypted: true,
      content: 'ciphertext',
    },
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-1',
    hasMore: true,
    pendingSentMessages,
    setMessagesFn: (updater) => messages.set(updater),
    appendOrReplaceMessageFn: (_previousMessages, incomingMessage) => [incomingMessage],
    updateCachedConversationStateFn: (key, updater) => {
      cachedStates.push({ key, value: updater(null) });
    },
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    sanitizeCachedAttachmentsFn: (attachments) => attachments.map(({ _previewUrl, ...attachment }) => attachment),
    revokeAttachmentPreviewUrlsFn: (attachments) => revoked.push(attachments),
    persistDecryptedMessageFn: (...args) => persisted.push(args),
  });

  assert.deepEqual(result, { handled: true, finalizedPending: true });
  assert.equal(pendingSentMessages.size, 0);
  assert.equal(messages.value[0].content, 'hello');
  assert.equal(messages.value[0]._decrypted, true);
  assert.equal(messages.value[0]._ciphertextContent, 'ciphertext');
  assert.equal(persisted.length, 1);
  assert.equal(revoked.length, 1);
  assert.equal(cachedStates.length, 1);
});

test('message realtime flow decrypts and appends non-pending incoming messages', async () => {
  const messages = createStateContainer([]);
  const cachedStates = [];

  const result = await processIncomingConversationMessage({
    message: {
      id: 'message-2',
      sender_id: 'user-2',
      dm_partner_id: 'user-1',
      encrypted: true,
      content: 'ciphertext-2',
    },
    conversation: { type: 'dm', id: 'user-2' },
    userId: 'user-1',
    hasMore: false,
    setMessagesFn: (updater) => messages.set(updater),
    tryDecryptMessageFn: async () => ({
      id: 'message-2',
      sender_id: 'user-2',
      dm_partner_id: 'user-1',
      encrypted: true,
      _decrypted: true,
      content: 'hello dm',
    }),
    appendOrReplaceMessageFn: (_previousMessages, incomingMessage) => [incomingMessage],
    updateCachedConversationStateFn: (key, updater) => {
      cachedStates.push({ key, value: updater(null) });
    },
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
  });

  assert.deepEqual(result, { handled: true, finalizedPending: false });
  assert.equal(messages.value[0].content, 'hello dm');
  assert.equal(cachedStates.length, 1);
});

test('message realtime flow applies edit and delete lifecycle updates through cached state', () => {
  const messages = createStateContainer([
    { id: 'message-1', content: 'hello', _decrypted: false },
    { id: 'message-2', content: 'secret', _decrypted: true },
  ]);
  const cachedStates = [];
  const deleted = [];

  applyEditedConversationMessage({
    messageId: 'message-1',
    content: 'edited',
    editedAt: '2026-03-25 20:30:00',
    conversationKey: 'user-1:room:room-1',
    setMessagesFn: (updater) => messages.set(updater),
    updateCachedConversationStateFn: (key, updater) => {
      cachedStates.push({ key, value: updater({ messages: messages.value, hasMore: true }) });
    },
  });

  assert.equal(messages.value[0].content, 'edited');
  assert.equal(messages.value[0].edited_at, '2026-03-25 20:30:00');

  applyDeletedConversationMessage({
    messageId: 'message-2',
    userId: 'user-1',
    conversationKey: 'user-1:room:room-1',
    deletePersistedMessageEntryFn: (...args) => deleted.push(args),
    setMessagesFn: (updater) => messages.set(updater),
    updateCachedConversationStateFn: (key, updater) => {
      cachedStates.push({ key, value: updater({ messages: messages.value, hasMore: true }) });
    },
  });

  assert.deepEqual(deleted, [['user-1', 'message-2']]);
  assert.deepEqual(messages.value.map((message) => message.id), ['message-1']);
  assert.equal(cachedStates.length, 2);
});
