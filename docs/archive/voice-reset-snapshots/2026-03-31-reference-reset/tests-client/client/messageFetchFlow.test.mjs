import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MESSAGE_ROOM_WARM_LIMIT,
  fetchConversationMessages,
  syncConversationRoomSenderKeys,
  warmRoomMessageCache,
} from '../../../client/src/features/messaging/messageFetchFlow.mjs';

test('message fetch flow synchronizes room sender keys before a normal room open', async () => {
  const calls = [];

  const result = await fetchConversationMessages({
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-a',
    apiFn: async (url) => {
      calls.push(['api', url]);
      return [
        { id: 'message-2', created_at: '2026-03-25T00:00:02.000Z' },
        { id: 'message-1', created_at: '2026-03-25T00:00:01.000Z' },
      ];
    },
    decryptConversationMessagesFn: async ({ messages }) => messages,
    syncConversationRoomSenderKeysFn: async (roomId) => {
      calls.push(['sync', roomId]);
      return 2;
    },
    sortMessagesChronologicallyFn: (messages) => [...messages].sort((left, right) => left.id.localeCompare(right.id)),
  });

  assert.deepEqual(calls, [
    ['sync', 'room-1'],
    ['api', '/api/messages/room/room-1?limit=50'],
  ]);
  assert.equal(result.messages[0].id, 'message-1');
  assert.equal(result.hasMore, false);
});

test('message fetch flow fast room open defers room sender-key recovery during decrypt', async () => {
  let capturedOptions = null;

  await fetchConversationMessages({
    conversation: { type: 'room', id: 'room-2' },
    userId: 'user-a',
    fastRoomOpen: true,
    quietDecrypt: true,
    apiFn: async () => [{ id: 'message-1' }],
    decryptConversationMessagesFn: async ({ options }) => {
      capturedOptions = options;
      return [];
    },
    syncConversationRoomSenderKeysFn: async () => {
      throw new Error('fast room open should not synchronously block on sender keys');
    },
    sortMessagesChronologicallyFn: (messages) => messages,
  });

  assert.deepEqual(capturedOptions, {
    quiet: true,
    deferRoomDecrypt: true,
    allowRoomSenderKeyRecovery: false,
  });
});

test('message warm flow skips cached rooms and warms the uncached subset', async () => {
  const cachedStates = [];
  const warmedConversations = [];

  await warmRoomMessageCache({
    rooms: [
      { id: 'room-1', name: 'Cached room' },
      { id: 'room-2', name: 'Warm room' },
      { id: 'room-3', name: 'Warm room 2' },
    ],
    userId: 'user-a',
    maxRooms: 2,
    concurrency: 2,
    isE2EInitializedFn: () => true,
    getCachedConversationStateFn: (conversation) => (
      conversation.id === 'room-1' ? { messages: [{ id: 'cached' }], hasMore: false } : null
    ),
    fetchConversationMessagesFn: async (conversation, userId, options) => {
      warmedConversations.push([conversation.id, userId, options.limit, options.fastRoomOpen]);
      return {
        messages: [{ id: `message:${conversation.id}` }],
        hasMore: false,
      };
    },
    cacheConversationStateFn: (...args) => {
      cachedStates.push(args);
    },
  });

  assert.deepEqual(warmedConversations, [
    ['room-2', 'user-a', MESSAGE_ROOM_WARM_LIMIT, true],
    ['room-3', 'user-a', MESSAGE_ROOM_WARM_LIMIT, true],
  ]);
  assert.equal(cachedStates.length, 2);
});

test('message room sender-key sync flushes control traffic after syncing', async () => {
  const calls = [];

  const count = await syncConversationRoomSenderKeys({
    roomId: 'room-1',
    syncRoomSenderKeysFn: async (roomId) => {
      calls.push(['sync', roomId]);
      return 3;
    },
    flushPendingControlMessagesNowFn: async () => {
      calls.push(['flush']);
    },
  });

  assert.equal(count, 3);
  assert.deepEqual(calls, [['sync', 'room-1'], ['flush']]);
});
