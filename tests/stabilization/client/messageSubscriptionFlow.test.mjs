import test from 'node:test';
import assert from 'node:assert/strict';

import {
  subscribeConversationLifecycle,
  subscribeConversationRealtime,
} from '../../../client/src/features/messaging/messageSubscriptionFlow.mjs';

function createSocket() {
  const handlers = new Map();
  return {
    handlers,
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    off(eventName, handler) {
      if (handlers.get(eventName) === handler) {
        handlers.delete(eventName);
      }
    },
  };
}

test('message subscription flow binds room realtime events through the shared processor', async () => {
  const socket = createSocket();
  const calls = [];

  const cleanup = subscribeConversationRealtime({
    socket,
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-a',
    hasMore: true,
    pendingSentMessages: new Map(),
    setMessagesFn: () => {},
    tryDecryptMessageFn: () => {},
    appendOrReplaceMessageFn: () => {},
    updateCachedConversationStateFn: () => {},
    getConversationCacheKeyFn: () => 'user-a:room:room-1',
    sanitizeCachedAttachmentsFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    persistDecryptedMessageFn: () => {},
    processIncomingConversationMessageFn: async (payload) => {
      calls.push(payload);
    },
  });

  await socket.handlers.get('room:message')?.({ id: 'message-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].conversation.id, 'room-1');
  cleanup();
  assert.equal(socket.handlers.has('room:message'), false);
});

test('message subscription flow binds lifecycle events with the canonical conversation key', () => {
  const socket = createSocket();
  const edited = [];
  const deleted = [];

  const cleanup = subscribeConversationLifecycle({
    socket,
    conversation: { type: 'dm', id: 'user-b' },
    userId: 'user-a',
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    setMessagesFn: () => {},
    updateCachedConversationStateFn: () => {},
    deletePersistedMessageEntryFn: () => {},
    applyEditedConversationMessageFn: (payload) => edited.push(payload),
    applyDeletedConversationMessageFn: (payload) => deleted.push(payload),
  });

  socket.handlers.get('message:edited')?.({
    messageId: 'message-1',
    content: 'edited',
    edited_at: '2026-03-25T21:00:00.000Z',
  });
  socket.handlers.get('message:deleted')?.({
    messageId: 'message-2',
  });

  assert.equal(edited[0].conversationKey, 'user-a:dm:user-b');
  assert.equal(deleted[0].conversationKey, 'user-a:dm:user-b');
  cleanup();
  assert.equal(socket.handlers.has('message:edited'), false);
  assert.equal(socket.handlers.has('message:deleted'), false);
});
