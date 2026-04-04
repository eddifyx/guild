import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createClientVoiceRecvTransport,
  createClientVoiceSendTransport,
  shouldEnableVoiceRecvInsertableStreams,
  shouldEnableVoiceSendInsertableStreams,
} from '../../../client/src/features/voice/voiceClientTransportRuntime.mjs';

function createFakeTransport(id) {
  const handlers = new Map();
  return {
    id,
    handlers,
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
  };
}

test('voice client transport runtime computes send insertable-stream policy correctly', () => {
  assert.equal(shouldEnableVoiceSendInsertableStreams({
    voiceSafeMode: true,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: true,
    purpose: 'voice',
  }), false);
  assert.equal(shouldEnableVoiceSendInsertableStreams({
    voiceSafeMode: true,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: true,
    purpose: 'screen',
  }), true);
  assert.equal(shouldEnableVoiceSendInsertableStreams({
    voiceSafeMode: false,
    disableVoiceInsertableStreams: true,
    insertableStreamsSupported: true,
    purpose: 'voice',
  }), false);
  assert.equal(shouldEnableVoiceSendInsertableStreams({
    voiceSafeMode: false,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: false,
    purpose: 'voice',
  }), false);
});

test('voice client transport runtime computes recv insertable-stream policy correctly', () => {
  assert.equal(shouldEnableVoiceRecvInsertableStreams({
    voiceSafeMode: true,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: true,
  }), false);
  assert.equal(shouldEnableVoiceRecvInsertableStreams({
    voiceSafeMode: false,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: true,
  }), true);
  assert.equal(shouldEnableVoiceRecvInsertableStreams({
    voiceSafeMode: false,
    disableVoiceInsertableStreams: true,
    insertableStreamsSupported: true,
  }), false);
});

test('voice client transport runtime builds send transport with callback wiring', async () => {
  const diagnostics = [];
  const emits = [];
  let sendConfig = null;
  const transport = createFakeTransport('send-1');

  const builtTransport = createClientVoiceSendTransport({
    device: {
      createSendTransport(config) {
        sendConfig = config;
        return transport;
      },
    },
    transportOptions: { id: 'transport-a', iceParameters: {} },
    chId: 'channel-1',
    purpose: 'voice',
    emitAsyncFn: async (eventName, payload) => {
      emits.push([eventName, payload]);
      if (eventName === 'voice:produce') {
        return { producerId: 'producer-1' };
      }
      return { ok: true };
    },
    recordLaneDiagnosticFn: (...args) => diagnostics.push(args),
    voiceSafeMode: false,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: true,
  });

  assert.equal(builtTransport, transport);
  assert.deepEqual(sendConfig.additionalSettings, { encodedInsertableStreams: true });
  assert.equal(diagnostics[0][1], 'send_transport_created');

  let connected = false;
  await new Promise((resolve, reject) => {
    transport.handlers.get('connect')({ dtlsParameters: { role: 'auto' } }, () => {
      connected = true;
      resolve();
    }, reject);
  });

  let produced = null;
  await new Promise((resolve, reject) => {
    transport.handlers.get('produce')({
      kind: 'audio',
      rtpParameters: { codecs: [] },
      appData: { source: 'microphone' },
    }, (payload) => {
      produced = payload;
      resolve();
    }, reject);
  });

  assert.equal(connected, true);
  assert.deepEqual(produced, { id: 'producer-1' });
  assert.deepEqual(emits, [
    ['voice:connect-transport', {
      channelId: 'channel-1',
      transportId: 'send-1',
      dtlsParameters: { role: 'auto' },
    }],
    ['voice:produce', {
      channelId: 'channel-1',
      transportId: 'send-1',
      kind: 'audio',
      rtpParameters: { codecs: [] },
      appData: { source: 'microphone' },
    }],
  ]);
});

test('voice client transport runtime leaves send transport on the plain lane when secure media transforms are unavailable', () => {
  let sendConfig = null;
  const transport = createFakeTransport('send-plain');

  createClientVoiceSendTransport({
    device: {
      createSendTransport(config) {
        sendConfig = config;
        return transport;
      },
    },
    transportOptions: { id: 'transport-plain', iceParameters: {} },
    chId: 'channel-plain',
    purpose: 'voice',
    emitAsyncFn: async () => ({ ok: true }),
    recordLaneDiagnosticFn: () => {},
    voiceSafeMode: false,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: false,
  });

  assert.deepEqual(sendConfig.additionalSettings, {});
});

test('voice client transport runtime builds recv transport with connect wiring', async () => {
  const diagnostics = [];
  const emits = [];
  let recvConfig = null;
  const transport = createFakeTransport('recv-1');

  const builtTransport = createClientVoiceRecvTransport({
    device: {
      createRecvTransport(config) {
        recvConfig = config;
        return transport;
      },
    },
    transportOptions: { id: 'transport-b', iceParameters: {} },
    chId: 'channel-2',
    emitAsyncFn: async (eventName, payload) => {
      emits.push([eventName, payload]);
      return { ok: true };
    },
    recordLaneDiagnosticFn: (...args) => diagnostics.push(args),
    voiceSafeMode: false,
    disableVoiceInsertableStreams: false,
    insertableStreamsSupported: true,
  });

  assert.equal(builtTransport, transport);
  assert.deepEqual(recvConfig.additionalSettings, { encodedInsertableStreams: true });
  assert.equal(diagnostics[0][1], 'recv_transport_created');

  let connected = false;
  await new Promise((resolve, reject) => {
    transport.handlers.get('connect')({ dtlsParameters: { fingerprints: [] } }, () => {
      connected = true;
      resolve();
    }, reject);
  });

  assert.equal(connected, true);
  assert.deepEqual(emits, [[
    'voice:connect-transport',
    {
      channelId: 'channel-2',
      transportId: 'recv-1',
      dtlsParameters: { fingerprints: [] },
    },
  ]]);
});
