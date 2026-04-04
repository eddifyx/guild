import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientMessagingFacadeRuntime } from '../../../client/src/features/crypto/signalClientMessagingFacadeRuntime.mjs';

test('signal client messaging facade runtime delegates secure direct and room message operations', async () => {
  const calls = [];
  const runtime = createSignalClientMessagingFacadeRuntime({
    signalCrypto: {
      encrypt: async (...args) => {
        calls.push(['encrypt', ...args]);
        return { type: 3, payload: 'ciphertext' };
      },
      decrypt: async (...args) => {
        calls.push(['decrypt', ...args]);
        return 'plaintext';
      },
      createSKDM: async (...args) => {
        calls.push(['create-skdm', ...args]);
        return 'skdm-payload';
      },
      processSKDM: async (...args) => {
        calls.push(['process-skdm', ...args]);
        return 'processed-skdm';
      },
      groupEncrypt: async (...args) => {
        calls.push(['group-encrypt', ...args]);
        return 'group-ciphertext';
      },
      groupDecrypt: async (...args) => {
        calls.push(['group-decrypt', ...args]);
        return { plaintext: 'group-plaintext' };
      },
      rekeyRoom: async (...args) => {
        calls.push(['rekey-room', ...args]);
        return 'rekeyed';
      },
    },
    state: {
      userId: 'self-1',
      deviceId: 7,
    },
    signalSessionRuntime: {
      ensureOutboundSignalReady: async () => {
        calls.push(['ensure-outbound-ready']);
      },
      ensureVerifiedSession: async (...args) => {
        calls.push(['ensure-verified-session', ...args]);
        return true;
      },
      sessionBootstrapRecipients: new Set(),
      getAddressKey: (userId, deviceId) => `${userId}:${deviceId}`,
    },
    signalIdentityRuntime: {
      bootstrapSessionFromVerifiedBundle: async (...args) => {
        calls.push(['bootstrap-session', ...args]);
        return true;
      },
      requireTrustedNpub: async (...args) => {
        calls.push(['require-trusted-npub', ...args]);
        return 'npub-target';
      },
      fetchVerifiedIdentity: async (...args) => {
        calls.push(['fetch-verified-identity', ...args]);
        return { identityKey: 'ik' };
      },
      listVerifiedDevicesForUser: async (...args) => {
        calls.push(['list-verified-devices', ...args]);
        return [{ deviceId: 1 }];
      },
      listVerifiedSiblingDevicesBestEffort: async (...args) => {
        calls.push(['list-verified-siblings', ...args]);
        return [{ deviceId: 9 }];
      },
    },
    buildDirectMessageEnvelopePayloadFn: ({ recipientId, senderDeviceId, copies }) => ({
      recipientId,
      senderDeviceId,
      copies,
    }),
    buildDirectMessageTargetsFn: ({ recipientId }) => [{ userId: recipientId, deviceId: 1 }],
  });

  assert.deepEqual(await runtime.signalEncrypt('peer-1', 2, 'hello guild'), { type: 3, payload: 'ciphertext' });
  assert.equal(await runtime.signalDecrypt('peer-1', 2, 3, 'payload'), 'plaintext');
  assert.deepEqual(await runtime.buildDirectMessageEnvelope('peer-2', 'hi there'), {
    recipientId: 'peer-2',
    senderDeviceId: 7,
    copies: [
      {
        recipientUserId: 'peer-2',
        recipientDeviceId: 1,
        type: 3,
        payload: 'ciphertext',
      },
    ],
  });
  assert.equal(await runtime.createSKDM('room-1'), 'skdm-payload');
  assert.equal(await runtime.processSKDM('peer-1', 'skdm-wire'), 'processed-skdm');
  assert.equal(await runtime.groupEncrypt('room-2', 'secret'), 'group-ciphertext');
  assert.equal(await runtime.groupDecrypt('peer-1', 'room-2', 'group-wire'), 'group-plaintext');
  assert.equal(await runtime.rekeyRoom('room-3'), 'rekeyed');

  assert.deepEqual(calls, [
    ['ensure-outbound-ready'],
    ['ensure-verified-session', 'peer-1', 2],
    ['encrypt', 'peer-1', 2, 'hello guild'],
    ['require-trusted-npub', 'peer-1', { quarantineSession: true }],
    ['fetch-verified-identity', 'peer-1', 2],
    ['decrypt', 'peer-1', 2, 3, 'payload'],
    ['ensure-outbound-ready'],
    ['list-verified-devices', 'peer-2', { forceRefresh: true }],
    ['list-verified-siblings'],
    ['ensure-outbound-ready'],
    ['ensure-verified-session', 'peer-2', 1],
    ['encrypt', 'peer-2', 1, 'hi there'],
    ['ensure-outbound-ready'],
    ['create-skdm', 'room-1'],
    ['process-skdm', 'peer-1', 'skdm-wire'],
    ['ensure-outbound-ready'],
    ['group-encrypt', 'room-2', 'secret'],
    ['group-decrypt', 'peer-1', 'room-2', 'group-wire'],
    ['ensure-outbound-ready'],
    ['rekey-room', 'room-3'],
  ]);
});
