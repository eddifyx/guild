import test from 'node:test';
import assert from 'node:assert/strict';

import { createSocketEncryptedControlRuntime } from '../../../client/src/features/crypto/socketEncryptedControlRuntime.mjs';

test('socket encrypted control runtime flushes queued sender-key messages and acknowledges receipts', async () => {
  const apiCalls = [];
  const remembered = [];
  const processed = [];
  const dispatched = [];

  const runtime = createSocketEncryptedControlRuntime({
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

test('socket encrypted control runtime re-queues retryable control messages until E2E becomes ready', async () => {
  let e2eReady = false;

  const runtime = createSocketEncryptedControlRuntime({
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

test('socket encrypted control runtime handles voice-key distributions and unknown control payloads', async () => {
  const dispatched = [];
  const processedVoice = [];
  let mode = 'voice';

  const runtime = createSocketEncryptedControlRuntime({
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => true,
    }),
    importMessageEncryptionFn: async () => ({
      decryptDirectMessage: async () => ({
        body: JSON.stringify(mode === 'voice'
          ? { type: 'voice_key_distribution', channelId: 'channel-1', epoch: 3 }
          : { type: 'mystery_control' }),
      }),
    }),
    importVoiceEncryptionFn: async () => ({
      processDecryptedVoiceKey: async (...args) => {
        processedVoice.push(args);
        return true;
      },
    }),
    createCustomEventFn: (type, detail) => ({ type, detail }),
    dispatchEventFn: (event) => dispatched.push(event),
  });

  const voiceResult = await runtime.processEncryptedControlMessage({
    fromUserId: 'user-9',
    envelope: 'voice-envelope',
  });
  mode = 'unknown';
  const unknownResult = await runtime.processEncryptedControlMessage({
    fromUserId: 'user-9',
    envelope: 'unknown-envelope',
  });

  assert.equal(voiceResult.type, 'voice_key_distribution');
  assert.equal(processedVoice.length, 1);
  assert.equal(dispatched[0].type, 'voice-key-updated');
  assert.deepEqual(unknownResult, {
    handled: false,
    type: 'mystery_control',
  });
});
