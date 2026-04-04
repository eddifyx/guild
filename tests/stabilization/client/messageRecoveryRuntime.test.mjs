import test from 'node:test';
import assert from 'node:assert/strict';

import { E2E_INIT_READY_EVENT } from '../../../client/src/features/auth/secureSessionFlow.mjs';
import {
  bindRoomSenderKeyRetry,
  schedulePendingDecryptExpiry,
} from '../../../client/src/features/messaging/messageRecoveryRuntime.mjs';

function createWindowStub() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    removeEventListener(eventName, handler) {
      if (listeners.get(eventName) === handler) {
        listeners.delete(eventName);
      }
    },
    setTimeout(handler) {
      this.timeoutHandler = handler;
      return 'timeout-id';
    },
    clearTimeout(timeoutId) {
      this.clearedTimeoutId = timeoutId;
    },
  };
}

test('message recovery runtime retries failed room messages for matching sender-key updates and secure-ready events', () => {
  const windowStub = createWindowStub();
  const calls = [];

  const cleanup = bindRoomSenderKeyRetry({
    conversation: { type: 'room', id: 'room-1' },
    retryFailedVisibleRoomMessagesFn: (options) => calls.push(options),
    windowObj: windowStub,
  });

  windowStub.listeners.get('sender-key-updated')?.({ detail: { roomId: 'room-2' } });
  windowStub.listeners.get('sender-key-updated')?.({ detail: { roomId: 'room-1' } });
  windowStub.listeners.get(E2E_INIT_READY_EVENT)?.();

  assert.deepEqual(calls, [{ allowRoomSenderKeyRecovery: false }, undefined]);
  cleanup();
  assert.equal(windowStub.listeners.has('sender-key-updated'), false);
  assert.equal(windowStub.listeners.has(E2E_INIT_READY_EVENT), false);
});

test('message recovery runtime schedules pending decrypt expiry and commits changed state', () => {
  const windowStub = createWindowStub();
  let committedMessages = [{ id: 'old' }];
  const cachedStates = [];

  const cleanup = schedulePendingDecryptExpiry({
    messages: committedMessages,
    conversation: { type: 'room', id: 'room-1' },
    hasMore: false,
    userId: 'user-a',
    visibleTimeoutMs: 3000,
    getPendingDecryptVisibilityDelayFn: () => 25,
    expirePendingDecryptMessagesFn: () => ({
      changed: true,
      messages: [{ id: 'expired' }],
    }),
    setMessagesFn: (updater) => {
      committedMessages = updater(committedMessages);
    },
    cacheConversationStateFn: (...args) => {
      cachedStates.push(args);
    },
    windowObj: windowStub,
    nowFn: () => 123,
  });

  windowStub.timeoutHandler?.();
  assert.deepEqual(committedMessages, [{ id: 'expired' }]);
  assert.equal(cachedStates.length, 1);
  cleanup();
  assert.equal(windowStub.clearedTimeoutId, 'timeout-id');
});

test('message recovery runtime skips timers when there is no pending expiry work', () => {
  const windowStub = createWindowStub();

  const cleanup = schedulePendingDecryptExpiry({
    messages: [],
    conversation: { type: 'room', id: 'room-1' },
    visibleTimeoutMs: 3000,
    getPendingDecryptVisibilityDelayFn: () => null,
    windowObj: windowStub,
  });

  assert.equal(typeof cleanup, 'function');
  assert.equal(windowStub.timeoutHandler, undefined);
});
