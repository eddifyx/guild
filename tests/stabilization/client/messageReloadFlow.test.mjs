import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS,
  runMessageReloadFlow,
} from '../../../client/src/features/messaging/messageReloadFlow.mjs';

function createStateContainer(initialValue) {
  return {
    value: initialValue,
    set(nextValue) {
      this.value = typeof nextValue === 'function' ? nextValue(this.value) : nextValue;
    },
  };
}

test('message reload flow commits a room snapshot and schedules deferred sender-key sync', async () => {
  const loading = createStateContainer(false);
  const messages = createStateContainer([]);
  const hasMore = createStateContainer(true);
  const error = createStateContainer('old');
  const diagnostics = [];
  const logs = [];
  let timeoutCallback = null;
  let timeoutHandle = null;
  let retried = 0;

  await runMessageReloadFlow({
    conversation: { type: 'room', id: 'room-1' },
    userId: 'user-1',
    perfTraceId: 'perf-1',
    currentMessages: [],
    clearDeferredRoomSenderKeySyncFn: () => logs.push(['clear-timeout']),
    isConversationActiveFn: () => true,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    messageBelongsToConversationFn: (message, conversation) => message?.room_id === conversation.id,
    setLoadingFn: (nextValue) => loading.set(nextValue),
    setMessagesFn: (updater) => messages.set(updater),
    setHasMoreFn: (nextValue) => hasMore.set(nextValue),
    setErrorFn: (nextValue) => error.set(nextValue),
    fetchConversationMessagesFn: async () => ({
      messages: [{ id: 'message-1', room_id: 'room-1', content: 'hello' }],
      hasMore: false,
      roomSenderKeySyncPromise: null,
    }),
    cacheConversationStateFn: () => {},
    replaceMessagesFromSnapshotFn: (_previousMessages, nextMessages) => nextMessages,
    mergeMessagesByIdFn: (_previousMessages, nextMessages) => nextMessages,
    debugRoomOpenLogFn: (phase, payload) => logs.push([phase, payload?.roomId || null]),
    addPerfPhaseFn: (...args) => diagnostics.push(args),
    syncConversationRoomSenderKeysFn: async () => {},
    retryFailedVisibleRoomMessagesFn: async () => {
      retried += 1;
    },
    setDeferredRoomSenderKeySyncHandleFn: (handle) => {
      timeoutHandle = handle;
    },
    setTimeoutFn: (fn, delayMs) => {
      assert.equal(delayMs, DEFERRED_ROOM_SENDER_KEY_SYNC_DELAY_MS);
      timeoutCallback = fn;
      return 'timeout-room-1';
    },
    nowFn: (() => {
      let tick = 1_000;
      return () => {
        tick += 25;
        return tick;
      };
    })(),
    warnFn: (...args) => logs.push(['warn', ...args]),
  });

  assert.equal(loading.value, false);
  assert.equal(hasMore.value, false);
  assert.equal(error.value, '');
  assert.equal(messages.value.length, 1);
  assert.equal(messages.value[0].id, 'message-1');
  assert.equal(timeoutHandle, 'timeout-room-1');
  assert.equal(typeof timeoutCallback, 'function');
  timeoutCallback();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(retried, 1);
  assert.equal(diagnostics.some(([, phase]) => phase === 'messages:reload-ready'), true);
  assert.equal(diagnostics.some(([, phase]) => phase === 'messages:sender-key-sync-finished'), true);
});

test('message reload flow surfaces the shared unavailable state for unsupported DMs', async () => {
  const loading = createStateContainer(true);
  const messages = createStateContainer([{ id: 'old' }]);
  const hasMore = createStateContainer(true);
  const error = createStateContainer('');

  const result = await runMessageReloadFlow({
    conversation: { type: 'dm', id: 'user-2', dmUnsupported: true },
    userId: 'user-1',
    currentMessages: [],
    clearDeferredRoomSenderKeySyncFn: () => {},
    isConversationActiveFn: () => true,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    messageBelongsToConversationFn: () => false,
    setLoadingFn: (nextValue) => loading.set(nextValue),
    setMessagesFn: (nextValue) => messages.set(nextValue),
    setHasMoreFn: (nextValue) => hasMore.set(nextValue),
    setErrorFn: (nextValue) => error.set(nextValue),
  });

  assert.deepEqual(result, {
    skipped: true,
    reason: 'dm-unsupported',
    conversationKey: 'user-1:dm:user-2',
  });
  assert.equal(loading.value, false);
  assert.deepEqual(messages.value, []);
  assert.equal(hasMore.value, false);
  assert.match(error.value, /Direct messages are only available/);
});

test('message reload flow reports fetch failures without mutating stale conversations', async () => {
  const loading = createStateContainer(false);
  const error = createStateContainer('');
  const warnings = [];

  const result = await runMessageReloadFlow({
    conversation: { type: 'room', id: 'room-error' },
    userId: 'user-1',
    currentMessages: [],
    clearDeferredRoomSenderKeySyncFn: () => {},
    isConversationActiveFn: () => true,
    getConversationCacheKeyFn: (conversation, userId) => `${userId}:${conversation.type}:${conversation.id}`,
    messageBelongsToConversationFn: () => false,
    setLoadingFn: (nextValue) => loading.set(nextValue),
    setMessagesFn: () => {},
    setHasMoreFn: () => {},
    setErrorFn: (nextValue) => error.set(nextValue),
    fetchConversationMessagesFn: async () => {
      throw new Error('fetch failed');
    },
    addPerfPhaseFn: () => {},
    warnFn: (...args) => warnings.push(args),
  });

  assert.equal(result.error.message, 'fetch failed');
  assert.equal(loading.value, false);
  assert.equal(error.value, 'fetch failed');
  assert.equal(warnings.length, 1);
});
