import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDebugRoomOpenLogger,
  createDecryptMessages,
  createFetchConversationMessages,
  createSyncConversationRoomSenderKeys,
  createTryDecryptMessage,
  createWarmRoomMessageCache,
} from '../../../client/src/features/messaging/messageHookDependencies.mjs';

test('message hook dependencies build the room-open logger through the electron bridge safely', () => {
  const calls = [];
  const logger = createDebugRoomOpenLogger({
    windowObj: {
      electronAPI: {
        debugLog: (...args) => calls.push(args),
      },
    },
  });
  logger('messages-committed', { roomId: 'room-1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'room-open');
  assert.match(calls[0][1], /"phase":"messages-committed"/);
});

test('message hook dependencies build decrypt helpers with the canonical dependency bag', async () => {
  const tryCalls = [];
  const decryptCalls = [];
  const reportCalls = [];

  const tryDecryptMessage = createTryDecryptMessage({
    tryDecryptConversationMessageFn: async (options) => {
      tryCalls.push(options);
      options.reportDecryptFailureFn({ message: 'm1', error: new Error('boom'), quiet: true });
      return 'try-result';
    },
    reportDecryptFailureFn: (payload) => reportCalls.push(payload),
    windowObj: { label: 'window' },
  });
  const decryptMessages = createDecryptMessages({
    decryptConversationMessagesFn: async (options) => {
      decryptCalls.push(options);
      options.reportDecryptFailureFn({ message: 'm2', error: new Error('fail'), quiet: false });
      return 'decrypt-result';
    },
    reportDecryptFailureFn: (payload) => reportCalls.push(payload),
    windowObj: { label: 'window' },
  });

  assert.equal(await tryDecryptMessage({ id: 'm1' }, 'user-1', { retries: 1 }, { quiet: true }), 'try-result');
  assert.equal(await decryptMessages([{ id: 'm2' }], 'user-1', { quiet: false }), 'decrypt-result');
  assert.equal(tryCalls[0].userId, 'user-1');
  assert.equal(decryptCalls[0].userId, 'user-1');
  assert.equal(tryCalls[0].windowObj.label, 'window');
  assert.equal(decryptCalls[0].windowObj.label, 'window');
  assert.deepEqual(reportCalls.map((entry) => [entry.message, entry.quiet]), [
    ['m1', true],
    ['m2', false],
  ]);
});

test('message hook dependencies build fetch and warm-cache helpers with stable nested contracts', async () => {
  const syncCalls = [];
  const fetchCalls = [];
  const cacheCalls = [];
  const warmCalls = [];

  const syncConversationRoomSenderKeys = createSyncConversationRoomSenderKeys({
    syncConversationRoomSenderKeysFlowFn: async (options) => {
      syncCalls.push(options);
      return 'synced';
    },
    syncRoomSenderKeysFn: () => {},
    flushPendingControlMessagesNowFn: () => {},
  });

  const fetchConversationMessages = createFetchConversationMessages({
    fetchConversationMessagesFlowFn: async (options) => {
      fetchCalls.push(options);
      await options.decryptConversationMessagesFn({ messages: ['raw'], userId: 'user-2', options: { quiet: true } });
      await options.syncConversationRoomSenderKeysFn('room-2');
      return 'fetched';
    },
    apiFn: async () => 'api',
    decryptMessagesFn: async (messages, userId, options) => ({ messages, userId, options }),
    syncConversationRoomSenderKeysFn: syncConversationRoomSenderKeys,
    sortMessagesChronologicallyFn: (messages) => messages,
    warnFn: () => {},
  });

  const warmRoomMessageCache = createWarmRoomMessageCache({
    warmRoomMessageCacheFlowFn: async (options) => {
      warmCalls.push(options);
      await options.fetchConversationMessagesFn({ type: 'room', id: 'room-3' }, 'user-3', { limit: 10 });
      options.cacheConversationStateFn({ id: 'room-3' }, ['msg'], false, 'user-3');
      return 'warmed';
    },
    roomWarmLimit: 12,
    isE2EInitializedFn: () => true,
    getCachedConversationStateFn: () => null,
    fetchConversationMessagesFn: fetchConversationMessages,
    cacheConversationStateFn: (...args) => cacheCalls.push(args),
    sortMessagesChronologicallyFn: (messages) => messages,
    warnFn: () => {},
  });

  assert.equal(await fetchConversationMessages({ type: 'room', id: 'room-2' }, 'user-2'), 'fetched');
  assert.equal(await warmRoomMessageCache([{ id: 'room-3' }], 'user-3'), 'warmed');
  assert.equal(syncCalls.length, 2);
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].conversation.id, 'room-2');
  assert.equal(fetchCalls[1].conversation.id, 'room-3');
  assert.equal(warmCalls[0].roomWarmLimit, 12);
  assert.equal(cacheCalls.length, 1);
  assert.equal(typeof cacheCalls[0][4].sortMessagesChronologicallyFn, 'function');
});
