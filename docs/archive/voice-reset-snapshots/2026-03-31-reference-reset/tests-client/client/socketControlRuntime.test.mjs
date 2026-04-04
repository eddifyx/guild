import test from 'node:test';
import assert from 'node:assert/strict';

import { createSocketControlRuntime } from '../../../client/src/features/crypto/socketControlRuntime.mjs';

test('socket control runtime flushes queued sender-key messages and acknowledges receipts', async () => {
  const apiCalls = [];
  const remembered = [];
  const processed = [];
  const dispatched = [];

  const runtime = createSocketControlRuntime({
    apiRequestFn: async (...args) => {
      apiCalls.push(args);
      return null;
    },
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => true,
    }),
    importIdentityDirectoryFn: async () => ({
      rememberUserNpub: (...args) => remembered.push(args),
    }),
    importMessageEncryptionFn: async () => ({
      decryptDirectMessage: async () => ({
        body: JSON.stringify({
          type: 'sender_key_distribution',
          roomId: 'room-1',
        }),
      }),
    }),
    importSenderKeysFn: async () => ({
      processDecryptedSenderKey: async (...args) => processed.push(args),
    }),
    createCustomEventFn: (type, detail) => ({ type, detail }),
    dispatchEventFn: (event) => dispatched.push(event),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    nowFn: () => 1_000,
  });

  runtime.queuePendingControlMessage({
    id: 'dist-1',
    fromUserId: 'user-1',
    senderNpub: 'npub1test',
    envelope: 'ciphertext',
    roomId: 'room-1',
  });

  await runtime.flushPendingControlMessagesNow();

  assert.deepEqual(remembered, [['user-1', 'npub1test']]);
  assert.equal(processed.length, 1);
  assert.equal(dispatched[0].type, 'sender-key-updated');
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0][0], '/api/rooms/room-1/sender-keys/ack');
  assert.equal(runtime.getStateSnapshot().pendingControlMessageCount, 0);
});

test('socket control runtime re-queues retryable control messages until E2E becomes ready', async () => {
  let e2eReady = false;

  const runtime = createSocketControlRuntime({
    apiRequestFn: async () => null,
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => e2eReady,
    }),
    importMessageEncryptionFn: async () => ({
      decryptDirectMessage: async () => ({
        body: JSON.stringify({
          type: 'sender_key_distribution',
          roomId: 'room-2',
        }),
      }),
    }),
    importSenderKeysFn: async () => ({
      processDecryptedSenderKey: async () => {},
    }),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
    nowFn: () => 2_000,
  });

  runtime.queuePendingControlMessage({
    id: 'dist-2',
    fromUserId: 'user-2',
    envelope: 'ciphertext-2',
    roomId: 'room-2',
  });

  await runtime.flushPendingControlMessagesNow();
  assert.equal(runtime.getStateSnapshot().pendingControlMessageCount, 1);

  e2eReady = true;
  await runtime.flushPendingControlMessagesNow();
  assert.equal(runtime.getStateSnapshot().pendingControlMessageCount, 0);
});

test('socket control runtime dedupes room sender-key requests and resolves them through the socket ack', async () => {
  const emits = [];
  const scheduledTimeouts = [];

  const runtime = createSocketControlRuntime({
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

test('socket control runtime event handlers rekey rooms, redistribute sender keys, and clear disconnect state', async () => {
  const rekeyCalls = [];
  const redistributeCalls = [];

  const runtime = createSocketControlRuntime({
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => true,
    }),
    importSenderKeysFn: async () => ({
      rekeyRoom: async (roomId) => rekeyCalls.push(roomId),
      redistributeSenderKey: async (roomId) => redistributeCalls.push(roomId),
      processDecryptedSenderKey: async () => {},
    }),
  });

  await runtime.createRoomMemberRemovedHandler()({ roomId: 'room-4' });
  await runtime.createRoomSenderKeyRequestedHandler()({ roomId: 'room-5' });

  assert.deepEqual(rekeyCalls, ['room-4']);
  assert.deepEqual(redistributeCalls, ['room-5']);

  const pendingRequest = runtime.requestRoomSenderKey({
    socket: {
      emit() {},
    },
    roomId: 'room-6',
    senderUserId: 'user-6',
  });

  runtime.handleSocketDisconnect();
  assert.equal(await pendingRequest, false);
});

test('socket control runtime direct sender-key handler processes and acknowledges through the encrypted-control runtime', async () => {
  const apiCalls = [];
  const processed = [];

  const runtime = createSocketControlRuntime({
    apiRequestFn: async (...args) => {
      apiCalls.push(args);
      return null;
    },
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => true,
    }),
    importMessageEncryptionFn: async () => ({
      decryptDirectMessage: async () => ({
        body: JSON.stringify({
          type: 'sender_key_distribution',
          roomId: 'room-7',
        }),
      }),
    }),
    importSenderKeysFn: async () => ({
      processDecryptedSenderKey: async (...args) => processed.push(args),
    }),
    createCustomEventFn: (type, detail) => ({ type, detail }),
    dispatchEventFn: () => {},
  });

  const handler = runtime.createDirectSenderKeyHandler();
  await handler({
    id: 'dist-7',
    fromUserId: 'user-7',
    envelope: 'cipher-7',
    roomId: 'room-7',
  });

  assert.equal(processed.length, 1);
  assert.equal(apiCalls.length, 1);
  assert.equal(apiCalls[0][0], '/api/rooms/room-7/sender-keys/ack');
});
