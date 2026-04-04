import test from 'node:test';
import assert from 'node:assert/strict';

import { createSocketRoomSenderKeyRuntime } from '../../../client/src/features/crypto/socketRoomSenderKeyRuntime.mjs';

test('socket room sender-key runtime dedupes room sender-key requests and resolves them through the socket ack', async () => {
  const emits = [];
  const scheduledTimeouts = [];

  const runtime = createSocketRoomSenderKeyRuntime({
    setTimeoutFn: (fn) => {
      scheduledTimeouts.push(fn);
      return scheduledTimeouts.length;
    },
    clearTimeoutFn: () => {},
  });

  const socket = {
    emit(event, payload, callback) {
      emits.push([event, payload, callback]);
    },
  };

  const first = runtime.requestRoomSenderKey({
    socket,
    roomId: 'room-3',
    senderUserId: 'user-3',
  });
  const second = runtime.requestRoomSenderKey({
    socket,
    roomId: 'room-3',
    senderUserId: 'user-3',
  });

  assert.equal(first, second);
  assert.equal(emits.length, 1);
  emits[0][2]({ ok: true });

  assert.equal(await first, true);
  assert.equal(runtime.getStateSnapshot().pendingRoomSenderKeyRequestCount, 0);
});

test('socket room sender-key runtime clears pending requests on disconnect-style cleanup', async () => {
  const runtime = createSocketRoomSenderKeyRuntime({
    setTimeoutFn: () => 1,
    clearTimeoutFn: () => {},
  });

  const pendingRequest = runtime.requestRoomSenderKey({
    socket: {
      emit() {},
    },
    roomId: 'room-6',
    senderUserId: 'user-6',
  });

  runtime.clearPendingRoomSenderKeyRequests();
  assert.equal(await pendingRequest, false);
});

test('socket room sender-key runtime syncs stored keys, queues retryable entries, and acknowledges handled ids', async () => {
  const apiCalls = [];
  const processedEntries = [];
  const queuedEntries = [];

  const runtime = createSocketRoomSenderKeyRuntime({
    apiRequestFn: async (...args) => {
      apiCalls.push(args);
      if (args[0].includes('/sender-keys?')) {
        return [
          { id: 'entry-1', roomId: 'room-7', envelope: 'good', fromUserId: 'user-7' },
          { id: 'entry-2', roomId: 'room-7', envelope: 'retry', fromUserId: 'user-8' },
          { id: 'entry-3', roomId: 'room-7', envelope: 'duplicate', fromUserId: 'user-9' },
        ];
      }
      return null;
    },
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => true,
    }),
    processEncryptedControlMessageFn: async (entry) => {
      processedEntries.push(entry);
      if (entry.envelope === 'retry') {
        const err = new Error('not ready');
        err.retryable = true;
        throw err;
      }
      if (entry.envelope === 'duplicate') {
        throw new Error('DuplicatedMessage');
      }
      return { type: 'sender_key_distribution' };
    },
    queuePendingControlMessageFn: (entry) => queuedEntries.push(entry),
    shouldAcknowledgeSenderKeyErrorFn: (err) => String(err?.message).includes('DuplicatedMessage'),
    acknowledgeSenderKeyReceiptsFn: async (roomId, ids) => {
      apiCalls.push(['ack', roomId, ids]);
    },
    nowFn: () => 42,
    warnFn: () => {},
  });

  const count = await runtime.syncRoomSenderKeys('room-7', { includeDelivered: true, limit: 64 });

  assert.equal(count, 2);
  assert.equal(processedEntries.length, 3);
  assert.deepEqual(queuedEntries.map((entry) => entry.id), ['entry-2']);
  assert.deepEqual(apiCalls.at(-1), ['ack', 'room-7', ['entry-1', 'entry-3']]);
  assert.equal(runtime.getStateSnapshot().pendingRoomSenderKeySyncCount, 0);
});
