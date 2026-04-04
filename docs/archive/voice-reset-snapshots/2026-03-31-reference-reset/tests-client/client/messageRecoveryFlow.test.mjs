import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectRetryableConversationMessages,
  prioritizeRoomRecoveryMessages,
  retryFailedConversationMessages,
  getPendingDecryptVisibilityDelay,
  expirePendingDecryptMessages,
  shouldRetryFailedDMConversationMessages,
} from '../../../client/src/features/messaging/messageRecoveryFlow.mjs';

test('message recovery flow collects only retryable messages for the active conversation', () => {
  const roomConversation = { type: 'room', id: 'room-1' };
  const dmConversation = { type: 'dm', id: 'user-b' };
  const messages = [
    { id: 'room-ok', room_id: 'room-1', encrypted: true, _decryptionFailed: true },
    { id: 'room-other', room_id: 'room-2', encrypted: true, _decryptionFailed: true },
    { id: 'dm-ok', sender_id: 'user-b', dm_partner_id: 'user-a', encrypted: true, _decryptionPending: true },
    { id: 'plain', room_id: 'room-1', encrypted: false, _decryptionFailed: true },
  ];

  assert.deepEqual(
    collectRetryableConversationMessages({ messages, conversation: roomConversation, userId: 'user-a' }).map((message) => message.id),
    ['room-ok']
  );
  assert.deepEqual(
    collectRetryableConversationMessages({ messages, conversation: dmConversation, userId: 'user-a' }).map((message) => message.id),
    ['dm-ok']
  );
});

test('message recovery flow prioritizes the newest room failures first while preserving retry order', () => {
  const messages = Array.from({ length: 14 }, (_, index) => ({
    id: `msg-${index + 1}`,
    created_at: new Date(2026, 0, index + 1).toISOString(),
  }));

  const prioritized = prioritizeRoomRecoveryMessages(messages, {
    getMessageTimestampValueFn: (message) => Date.parse(message.created_at),
    limit: 4,
  });

  assert.deepEqual(
    prioritized.slice(0, 4).map((message) => message.id),
    ['msg-11', 'msg-12', 'msg-13', 'msg-14']
  );
  assert.deepEqual(
    prioritized.slice(4).map((message) => message.id),
    ['msg-1', 'msg-2', 'msg-3', 'msg-4', 'msg-5', 'msg-6', 'msg-7', 'msg-8', 'msg-9', 'msg-10']
  );
});

test('message recovery flow retries failed messages and commits visible replacements back into cache state', async () => {
  const conversation = { type: 'room', id: 'room-1' };
  const messages = [
    { id: 'msg-1', room_id: 'room-1', encrypted: true, _decryptionFailed: true, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'msg-2', room_id: 'room-1', encrypted: true, _decryptionPending: true, created_at: '2026-01-02T00:00:00.000Z' },
  ];
  let committedMessages = messages;
  let cachedState = null;

  const updated = await retryFailedConversationMessages({
    conversation,
    userId: 'user-a',
    messages,
    hasMore: false,
    tryDecryptMessageFn: async (message) => ({
      ...message,
      _decrypted: true,
      _decryptionFailed: false,
      _decryptionPending: false,
      content: `decrypted:${message.id}`,
    }),
    getConversationCacheKeyFn: (nextConversation, userId) => `${nextConversation.type}:${nextConversation.id}:${userId}`,
    currentConversationKeyFn: () => 'room:room-1:user-a',
    getMessageTimestampValueFn: (message) => Date.parse(message.created_at),
    setMessagesFn: (updater) => {
      committedMessages = updater(committedMessages);
    },
    cacheConversationStateFn: (...args) => {
      cachedState = args;
    },
  });

  assert.equal(updated, true);
  assert.equal(committedMessages[0].content, 'decrypted:msg-1');
  assert.equal(committedMessages[1].content, 'decrypted:msg-2');
  assert.deepEqual(cachedState, [conversation, committedMessages, false, 'user-a']);
});

test('message recovery flow computes pending visibility delay and expires old pending room messages', () => {
  const now = Date.UTC(2026, 0, 10, 0, 0, 10);
  const conversation = { type: 'room', id: 'room-1' };
  const messages = [
    {
      id: 'old',
      room_id: 'room-1',
      encrypted: true,
      _decryptionPending: true,
      _decryptionPendingSince: now - 5000,
      _decryptionBucket: 'missing-sender-key',
    },
    { id: 'fresh', room_id: 'room-1', encrypted: true, _decryptionPending: true, _decryptionPendingSince: now - 1000 },
  ];

  const delay = getPendingDecryptVisibilityDelay({
    messages,
    conversation,
    now,
    visibleTimeoutMs: 3000,
  });
  assert.equal(delay, 0);

  const expired = expirePendingDecryptMessages({
    messages,
    conversation,
    now,
    visibleTimeoutMs: 3000,
  });

  assert.equal(expired.changed, true);
  assert.equal(expired.messages[0]._decryptionFailed, true);
  assert.equal(expired.messages[0]._decryptionError, 'Secure room keys were unavailable for this message');
  assert.equal(expired.messages[1]._decryptionPending, true);
});

test('message recovery flow computes pending visibility delay and expires old pending DM messages', () => {
  const now = Date.UTC(2026, 0, 10, 0, 0, 10);
  const conversation = { type: 'dm', id: 'user-b' };
  const messages = [
    {
      id: 'old-dm',
      sender_id: 'user-b',
      dm_partner_id: 'user-a',
      encrypted: true,
      _decryptionPending: true,
      _decryptionPendingSince: now - 5000,
      _decryptionBucket: 'missing-dm-copy',
    },
    {
      id: 'fresh-dm',
      sender_id: 'user-a',
      dm_partner_id: 'user-b',
      encrypted: true,
      _decryptionPending: true,
      _decryptionPendingSince: now - 1000,
    },
  ];

  const delay = getPendingDecryptVisibilityDelay({
    messages,
    conversation,
    userId: 'user-a',
    now,
    visibleTimeoutMs: 3000,
  });
  assert.equal(delay, 0);

  const expired = expirePendingDecryptMessages({
    messages,
    conversation,
    userId: 'user-a',
    now,
    visibleTimeoutMs: 3000,
  });

  assert.equal(expired.changed, true);
  assert.equal(expired.messages[0]._decryptionFailed, true);
  assert.equal(expired.messages[0]._decryptionError, 'This secure message was not sent to this device');
  assert.equal(expired.messages[1]._decryptionPending, true);
});

test('message recovery flow retries failed or pending DMs even when the thread has no readable plaintext yet', () => {
  const conversation = { type: 'dm', id: 'user-b' };
  const unreadableMessages = [
    { id: 'failed', sender_id: 'user-b', dm_partner_id: 'user-a', encrypted: true, _decryptionFailed: true },
    { id: 'other-failed', sender_id: 'user-a', dm_partner_id: 'user-b', encrypted: true, _decryptionPending: true },
  ];

  assert.equal(
    shouldRetryFailedDMConversationMessages({ conversation, messages: unreadableMessages, userId: 'user-a' }),
    true
  );
});
