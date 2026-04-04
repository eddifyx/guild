import test from 'node:test';
import assert from 'node:assert/strict';

import { createSocketEncryptedControlMessageRuntime } from '../../../client/src/features/crypto/socketEncryptedControlMessageRuntime.mjs';

test('socket encrypted control message runtime processes sender-key and voice-key payloads through the canonical handlers', async () => {
  const remembered = [];
  const senderKeys = [];
  const voiceKeys = [];
  const dispatched = [];
  let mode = 'sender';

  const runtime = createSocketEncryptedControlMessageRuntime({
    apiRequestFn: async () => null,
    importSessionManagerFn: async () => ({
      isE2EInitialized: () => true,
    }),
    importIdentityDirectoryFn: async () => ({
      rememberUserNpub: (...args) => remembered.push(args),
    }),
    importMessageEncryptionFn: async () => ({
      decryptDirectMessage: async () => ({
        body: JSON.stringify(mode === 'sender'
          ? { type: 'sender_key_distribution', roomId: 'room-1' }
          : { type: 'voice_key_distribution', channelId: 'channel-1', epoch: 2 }),
      }),
    }),
    importSenderKeysFn: async () => ({
      processDecryptedSenderKey: async (...args) => senderKeys.push(args),
    }),
    importVoiceEncryptionFn: async () => ({
      processDecryptedVoiceKey: async (...args) => {
        voiceKeys.push(args);
        return true;
      },
    }),
    createCustomEventFn: (type, detail) => ({ type, detail }),
    dispatchEventFn: (event) => dispatched.push(event),
  });

  const senderResult = await runtime.processEncryptedControlMessage({
    fromUserId: 'user-1',
    senderNpub: 'npub1',
    envelope: 'cipher-1',
  });
  mode = 'voice';
  const voiceResult = await runtime.processEncryptedControlMessage({
    fromUserId: 'user-2',
    envelope: 'cipher-2',
  });

  assert.deepEqual(remembered, [['user-1', 'npub1']]);
  assert.equal(senderKeys.length, 1);
  assert.equal(voiceKeys.length, 1);
  assert.deepEqual(senderResult, {
    handled: true,
    type: 'sender_key_distribution',
    roomId: 'room-1',
  });
  assert.deepEqual(voiceResult, {
    handled: true,
    type: 'voice_key_distribution',
    channelId: 'channel-1',
  });
  assert.deepEqual(dispatched.map((event) => event.type), ['sender-key-updated', 'voice-key-updated']);
});

test('socket encrypted control message runtime only acknowledges canonical sender-key success and duplicate-style errors', async () => {
  const apiCalls = [];
  const runtime = createSocketEncryptedControlMessageRuntime({
    apiRequestFn: async (...args) => {
      apiCalls.push(args);
      return null;
    },
  });

  await runtime.acknowledgeProcessedControlMessage(
    { id: 'dist-1', roomId: 'room-1' },
    { type: 'sender_key_distribution' }
  );
  await runtime.acknowledgeProcessedControlMessage(
    { id: 'dist-2', roomId: 'room-2' },
    null,
    new Error('DuplicatedMessage')
  );
  await runtime.acknowledgeProcessedControlMessage(
    { id: 'dist-3', roomId: 'room-3' },
    { type: 'voice_key_distribution' }
  );
  await runtime.acknowledgeProcessedControlMessage(
    { id: 'dist-4', roomId: 'room-4' },
    null,
    new Error('fatal decrypt failure')
  );

  assert.equal(apiCalls.length, 2);
  assert.equal(apiCalls[0][0], '/api/rooms/room-1/sender-keys/ack');
  assert.equal(apiCalls[1][0], '/api/rooms/room-2/sender-keys/ack');
});
