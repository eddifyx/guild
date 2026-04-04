import test from 'node:test';
import assert from 'node:assert/strict';

import { createMessageControllerActions } from '../../../client/src/features/messaging/messageControllerActions.mjs';

function createWindowStub() {
  return {
    setTimeout: () => 11,
    clearTimeout: () => {},
    requestAnimationFrame: (callback) => callback(),
    crypto: {
      randomUUID: () => 'local-uuid-1',
    },
  };
}

test('message controller actions preserve reload and retry behavior contracts', async () => {
  const captured = {
    reload: null,
    retry: null,
    cacheCalls: [],
  };

  const actions = createMessageControllerActions({
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-1',
    hasMore: true,
    perfTraceId: 'trace-1',
    pendingSentMessagesRef: { current: new Map() },
    messagesRef: { current: [{ id: 'message-1' }] },
    prevConvRef: { current: 'room:user-1:room-1' },
    retryFailedVisibleRoomMessagesRef: { current: async () => {} },
    deferredRoomSenderKeySyncTimeoutRef: { current: null },
    clearDeferredRoomSenderKeySyncFn: () => {},
    setLoadingFn: () => {},
    setMessagesFn: () => {},
    setHasMoreFn: () => {},
    setErrorFn: () => {},
    flows: {
      runMessageReloadFlowFn: async (options) => {
        captured.reload = options;
      },
      retryFailedConversationMessagesFn: async (options) => {
        captured.retry = options;
      },
      cacheConversationStateFn: (...args) => {
        captured.cacheCalls.push(args);
      },
      sortMessagesChronologicallyFn: () => ['sorted'],
      getConversationCacheKeyFn: () => 'room:user-1:room-1',
      messageBelongsToConversationFn: () => true,
      fetchConversationMessagesFn: async () => ({ messages: [] }),
      replaceMessagesFromSnapshotFn: () => [],
      mergeMessagesByIdFn: () => [],
      debugRoomOpenLogFn: () => {},
      addPerfPhaseFn: () => {},
      syncConversationRoomSenderKeysFn: async () => {},
      dmUnavailableError: 'dm-unavailable',
      tryDecryptMessageFn: async () => {},
      getMessageTimestampValueFn: () => 123,
    },
    windowObject: createWindowStub(),
    consoleErrorFn: () => {},
  });

  await actions.reloadMessages();
  assert.equal(captured.reload.perfTraceId, 'trace-1');
  assert.equal(captured.reload.dmUnavailableError, 'dm-unavailable');
  assert.equal(captured.reload.currentMessages[0].id, 'message-1');

  captured.reload.cacheConversationStateFn('room-1', [{ id: 'message-2' }], false, 'user-1');
  assert.equal(captured.cacheCalls.length, 1);
  assert.equal(typeof captured.cacheCalls[0][4].sortMessagesChronologicallyFn, 'function');

  await actions.retryFailedVisibleMessages({ allowRoomSenderKeyRecovery: false });
  assert.equal(captured.retry.allowRoomSenderKeyRecovery, false);
  assert.equal(captured.retry.currentConversationKeyFn(), 'room:user-1:room-1');
});

test('message controller actions gate room retry to room conversations', async () => {
  let retryCalls = 0;

  const actions = createMessageControllerActions({
    conversation: { type: 'dm', id: 'dm-1' },
    userId: 'user-1',
    hasMore: false,
    pendingSentMessagesRef: { current: new Map() },
    messagesRef: { current: [] },
    prevConvRef: { current: 'dm:user-1:dm-1' },
    retryFailedVisibleRoomMessagesRef: { current: async () => {} },
    deferredRoomSenderKeySyncTimeoutRef: { current: null },
    clearDeferredRoomSenderKeySyncFn: () => {},
    setLoadingFn: () => {},
    setMessagesFn: () => {},
    setHasMoreFn: () => {},
    setErrorFn: () => {},
    flows: {
      retryFailedConversationMessagesFn: async () => {
        retryCalls += 1;
      },
      cacheConversationStateFn: () => {},
      sortMessagesChronologicallyFn: () => [],
      getConversationCacheKeyFn: () => 'dm:user-1:dm-1',
      getMessageTimestampValueFn: () => 0,
      tryDecryptMessageFn: async () => {},
    },
    windowObject: createWindowStub(),
  });

  await actions.retryFailedVisibleRoomMessages();
  assert.equal(retryCalls, 0);
});

test('message controller actions delegate send, load, edit, and delete through shared factories', async () => {
  const calls = [];

  const actions = createMessageControllerActions({
    socket: { emit: () => {} },
    conversation: { type: 'room', id: 'room-1' },
    user: { userId: 'user-1' },
    userId: 'user-1',
    messages: [{ id: 'message-1' }],
    loading: false,
    hasMore: true,
    pendingSentMessagesRef: { current: new Map() },
    messagesRef: { current: [] },
    prevConvRef: { current: 'room:user-1:room-1' },
    retryFailedVisibleRoomMessagesRef: { current: async () => {} },
    deferredRoomSenderKeySyncTimeoutRef: { current: null },
    clearDeferredRoomSenderKeySyncFn: () => {},
    setLoadingFn: () => {},
    setMessagesFn: () => {},
    setHasMoreFn: () => {},
    setErrorFn: () => {},
    flows: {
      cacheConversationStateFn: () => {},
      sortMessagesChronologicallyFn: () => [],
      getConversationCacheKeyFn: () => 'room:user-1:room-1',
      isE2EInitializedFn: () => true,
      hasKnownNpubFn: () => true,
      encryptGroupMessageFn: async () => ({ ciphertext: 'group' }),
      encryptDirectMessageFn: async () => ({ ciphertext: 'dm' }),
      createConversationTimestampFn: () => 456,
      appendOrReplaceMessageFn: () => [],
      updateCachedConversationStateFn: () => {},
      sanitizeCachedAttachmentsFn: (value) => value,
      persistDecryptedMessageFn: () => {},
      revokeAttachmentPreviewUrlsFn: () => {},
      createMessageSendActionFn: (options) => async (content, attachments) => {
        calls.push(['send', content, attachments, options.createLocalId()]);
        return 'sent';
      },
      fetchConversationMessagesFn: async () => ({ messages: [] }),
      prependOlderMessagesFn: () => [],
      createLoadMoreMessagesActionFn: (options) => async () => {
        calls.push(['loadMore', options.hasMore, options.messages.length]);
        return 'loaded';
      },
      createEditMessageActionFn: (options) => (messageId, content) => {
        calls.push(['edit', messageId, content, options.messages.length]);
        return 'edited';
      },
      createDeleteMessageActionFn: (options) => (messageId) => {
        calls.push(['delete', messageId, typeof options.warnFn]);
        return 'deleted';
      },
    },
    windowObject: createWindowStub(),
    consoleWarnFn: () => {},
    consoleErrorFn: () => {},
  });

  assert.equal(await actions.sendMessage('hello', ['file-1']), 'sent');
  assert.equal(await actions.loadMore(), 'loaded');
  assert.equal(actions.editMessage('message-1', 'updated'), 'edited');
  assert.equal(actions.deleteMessage('message-2'), 'deleted');

  assert.deepEqual(calls, [
    ['send', 'hello', ['file-1'], 'local-uuid-1'],
    ['loadMore', true, 1],
    ['edit', 'message-1', 'updated', 1],
    ['delete', 'message-2', 'function'],
  ]);
});
