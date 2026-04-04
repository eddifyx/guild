import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceRecvTransportSession,
  createVoiceSendTransportSession,
  getOrCreateVoiceScreenSendTransport,
} from '../../../client/src/features/voice/voiceTransportSessionFlow.mjs';

test('voice transport session flow creates and stores a send transport by purpose', async () => {
  const refs = {
    deviceRef: { current: { id: 'device-1' } },
    sendTransportRef: { current: null },
    screenSendTransportRef: { current: null },
  };

  const transport = await createVoiceSendTransportSession({
    chId: 'channel-1',
    purpose: 'voice',
    refs,
    emitAsyncFn: async () => ({ transportOptions: { id: 'transport-1' } }),
    createClientVoiceSendTransportFn: ({ device, transportOptions, purpose }) => ({
      id: `${purpose}-${transportOptions.id}`,
      device,
    }),
  });

  assert.equal(transport.id, 'voice-transport-1');
  assert.equal(refs.sendTransportRef.current.id, 'voice-transport-1');
  assert.equal(refs.screenSendTransportRef.current, null);
});

test('voice transport session flow reuses an open screen send transport', async () => {
  const existing = { id: 'screen-existing', closed: false };

  const transport = await getOrCreateVoiceScreenSendTransport({
    chId: 'channel-2',
    refs: {
      screenSendTransportRef: { current: existing },
    },
    createVoiceSendTransportSessionFn: async () => {
      throw new Error('should-not-create');
    },
  });

  assert.equal(transport, existing);
});

test('voice transport session flow creates and stores a recv transport', async () => {
  const refs = {
    deviceRef: { current: { id: 'device-2' } },
    recvTransportRef: { current: null },
  };

  const transport = await createVoiceRecvTransportSession({
    chId: 'channel-3',
    refs,
    emitAsyncFn: async () => ({ transportOptions: { id: 'transport-2' } }),
    createClientVoiceRecvTransportFn: ({ device, transportOptions }) => ({
      id: `recv-${transportOptions.id}`,
      device,
    }),
  });

  assert.equal(transport.id, 'recv-transport-2');
  assert.equal(refs.recvTransportRef.current.id, 'recv-transport-2');
});

test('voice transport session flow rejects invalid transport acknowledgements', async () => {
  await assert.rejects(() => createVoiceSendTransportSession({
    chId: 'channel-4',
    refs: {
      deviceRef: { current: { id: 'device-4' } },
      sendTransportRef: { current: null },
      screenSendTransportRef: { current: null },
    },
    emitAsyncFn: async () => null,
  }), /Voice server did not return transport options/);
});
