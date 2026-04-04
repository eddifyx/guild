import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildConversationLifecycleOptions,
  buildConversationRealtimeOptions,
  buildLoadMoreMessagesActionOptions,
  buildMessageMutationOptions,
  buildMessageReloadOptions,
  buildMessageSendActionOptions,
  buildRetryFailedMessagesOptions,
} from '../../../client/src/features/messaging/messageControllerBindings.mjs';

test('message controller bindings preserve reload and retry contracts', () => {
  const shared = {
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-1',
  };

  const reloadOptions = buildMessageReloadOptions({
    ...shared,
    perfTraceId: 'trace-1',
    currentMessages: [{ id: 'message-1' }],
    clearDeferredRoomSenderKeySyncFn: () => {},
    isConversationActiveFn: () => true,
    getConversationCacheKeyFn: () => 'room:user-1:room-1',
    messageBelongsToConversationFn: () => true,
    setLoadingFn: () => {},
    setMessagesFn: () => {},
    setHasMoreFn: () => {},
    setErrorFn: () => {},
    fetchConversationMessagesFn: async () => ({ messages: [] }),
    cacheConversationStateFn: () => {},
    replaceMessagesFromSnapshotFn: () => [],
    mergeMessagesByIdFn: () => [],
    debugRoomOpenLogFn: () => {},
    addPerfPhaseFn: () => {},
    syncConversationRoomSenderKeysFn: async () => {},
    retryFailedVisibleRoomMessagesFn: async () => {},
    setDeferredRoomSenderKeySyncHandleFn: () => {},
    setTimeoutFn: () => 1,
    warnFn: () => {},
    dmUnavailableError: 'unsupported',
  });

  assert.equal(reloadOptions.perfTraceId, 'trace-1');
  assert.equal(reloadOptions.dmUnavailableError, 'unsupported');

  const retryOptions = buildRetryFailedMessagesOptions({
    ...shared,
    messages: [{ id: 'message-1' }],
    hasMore: true,
    allowRoomSenderKeyRecovery: false,
    tryDecryptMessageFn: async () => {},
    getConversationCacheKeyFn: () => 'room:user-1:room-1',
    currentConversationKeyFn: () => 'room:user-1:room-1',
    getMessageTimestampValueFn: () => 10,
    setMessagesFn: () => {},
    cacheConversationStateFn: () => {},
  });

  assert.equal(retryOptions.allowRoomSenderKeyRecovery, false);
  assert.deepEqual(retryOptions.messages, [{ id: 'message-1' }]);
});

test('message controller bindings preserve realtime, lifecycle, and send contracts', () => {
  const conversation = { type: 'room', id: 'room-1' };
  const socket = { emit: () => {} };
  const pendingSentMessages = new Map();

  const realtimeOptions = buildConversationRealtimeOptions({
    socket,
    conversation,
    userId: 'user-1',
    hasMore: false,
    pendingSentMessages,
    setMessagesFn: () => {},
    tryDecryptMessageFn: async () => {},
    appendOrReplaceMessageFn: () => [],
    updateCachedConversationStateFn: () => {},
    getConversationCacheKeyFn: () => 'room:user-1:room-1',
    sanitizeCachedAttachmentsFn: (value) => value,
    revokeAttachmentPreviewUrlsFn: () => {},
    persistDecryptedMessageFn: () => {},
    processIncomingConversationMessageFn: () => {},
  });

  assert.equal(realtimeOptions.socket, socket);
  assert.equal(realtimeOptions.pendingSentMessages, pendingSentMessages);

  const lifecycleOptions = buildConversationLifecycleOptions({
    socket,
    conversation,
    userId: 'user-1',
    getConversationCacheKeyFn: () => 'room:user-1:room-1',
    setMessagesFn: () => {},
    updateCachedConversationStateFn: () => {},
    deletePersistedMessageEntryFn: () => {},
    applyEditedConversationMessageFn: () => {},
    applyDeletedConversationMessageFn: () => {},
  });

  assert.equal(lifecycleOptions.socket, socket);
  assert.equal(lifecycleOptions.userId, 'user-1');

  const sendOptions = buildMessageSendActionOptions({
    socket,
    conversation,
    user: { userId: 'user-1' },
    hasMore: false,
    pendingSentMessagesRef: { current: pendingSentMessages },
    isConversationActiveFn: () => true,
    isE2EInitializedFn: () => true,
    hasKnownNpubFn: () => true,
    encryptGroupMessageFn: async () => ({ ciphertext: 'abc' }),
    encryptDirectMessageFn: async () => ({ ciphertext: 'def' }),
    getConversationCacheKeyFn: () => 'room:user-1:room-1',
    createConversationTimestampFn: () => 123,
    appendOrReplaceMessageFn: () => [],
    updateCachedConversationStateFn: () => {},
    sanitizeCachedAttachmentsFn: (value) => value,
    persistDecryptedMessageFn: () => {},
    revokeAttachmentPreviewUrlsFn: () => {},
    setMessages: () => {},
    createLocalId: () => 'local-1',
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
  });

  assert.equal(sendOptions.createLocalId(), 'local-1');
  assert.equal(sendOptions.user.userId, 'user-1');
});

test('message controller bindings preserve load-more and mutation contracts', () => {
  const loadMoreOptions = buildLoadMoreMessagesActionOptions({
    conversation: { type: 'room', id: 'room-1' },
    messages: [{ id: 'message-1' }],
    loading: false,
    hasMore: true,
    userId: 'user-1',
    isConversationActiveFn: () => true,
    getConversationCacheKeyFn: () => 'room:user-1:room-1',
    fetchConversationMessagesFn: async () => ({ messages: [] }),
    prependOlderMessagesFn: () => [],
    cacheConversationStateFn: () => {},
    setLoadingFn: () => {},
    setHasMoreFn: () => {},
    setMessagesFn: () => {},
    errorFn: () => {},
  });

  assert.equal(loadMoreOptions.hasMore, true);
  assert.deepEqual(loadMoreOptions.messages, [{ id: 'message-1' }]);

  const mutationOptions = buildMessageMutationOptions({
    socket: { emit: () => {} },
    messages: [{ id: 'message-1' }],
    warnFn: () => {},
  });

  assert.deepEqual(mutationOptions.editOptions.messages, [{ id: 'message-1' }]);
  assert.equal(typeof mutationOptions.deleteOptions.warnFn, 'function');
});
