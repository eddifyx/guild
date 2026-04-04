import test from 'node:test';
import assert from 'node:assert/strict';

import { createSenderKeyRoomRuntime } from '../../../client/src/features/crypto/senderKeyRoomRuntime.mjs';

function createRuntime(overrides = {}) {
  const calls = {
    createSKDM: [],
    groupEncrypt: [],
    groupDecrypt: [],
    processSKDM: [],
    encryptDirectMessage: [],
    api: [],
    rememberUsers: [],
    warnings: [],
    socketEvents: [],
    rekeyRoom: [],
  };

  const socket = {
    connected: overrides.socketConnected ?? true,
    emit(event, payload, ack) {
      calls.socketEvents.push([event, payload]);
      if (typeof ack === 'function') {
        const response = overrides.rejectedRecipients?.includes(payload?.toUserId)
          ? { ok: false, error: `rejected:${payload?.toUserId}` }
          : { ok: true };
        ack(response);
      }
    },
  };

  const runtime = createSenderKeyRoomRuntime({
    getCurrentUserIdFn: () => 'user-a',
    createSKDMFn: async (roomId) => {
      calls.createSKDM.push(roomId);
      return { skdm: `skdm:${roomId}`, distributionId: `dist:${roomId}` };
    },
    processSKDMFn: async (...args) => {
      calls.processSKDM.push(args);
    },
    groupEncryptFn: async (...args) => {
      calls.groupEncrypt.push(args);
      return `cipher:${args[1]}`;
    },
    groupDecryptFn: async (...args) => {
      calls.groupDecrypt.push(args);
      return JSON.stringify({ body: 'decrypted body', attachments: [], ts: 123 });
    },
    rekeyRoomFn: async (roomId) => {
      calls.rekeyRoom.push(roomId);
      return { skdm: `rekey:${roomId}`, distributionId: `rekey-dist:${roomId}` };
    },
    encryptDirectMessageFn: async (...args) => {
      calls.encryptDirectMessage.push(args);
      if (overrides.failRecipients?.includes(args[0])) throw new Error(`failed:${args[0]}`);
      return `envelope:${args[0]}`;
    },
    apiRequestFn: async (path) => {
      calls.api.push(path);
      return overrides.members || [
        { id: 'user-a', npub: 'npub1self' },
        { id: 'user-b', npub: 'npub1valid' },
      ];
    },
    getSocketFn: () => socket,
    rememberUsersFn: (members) => {
      calls.rememberUsers.push(members);
    },
    buildSenderKeyDistributionPayloadFn: ({ roomId, senderUserId, skdmBase64 }) => JSON.stringify({
      type: 'sender_key_distribution',
      v: 2,
      roomId,
      senderUserId,
      skdm: skdmBase64,
    }),
    emitSenderKeyDistributionWarningFn: (warning) => {
      calls.warnings.push(warning);
    },
    runWithConcurrencyFn: async (items, _limit, worker) => Promise.all(items.map(worker)),
    selectSenderKeyRecipientsFn: (members, currentUserId) => members.filter(
      (member) => member.id !== currentUserId && member.npub?.startsWith('npub1'),
    ),
    summarizeSenderKeyDistributionResultsFn: (results) => ({
      deliveredCount: results.filter((result) => result?.ok).length,
      failures: results.filter((result) => result && !result.ok).map((result) => result.member.id),
    }),
    distributionConcurrency: 2,
    nowFn: () => 12345,
    errorFn: () => {},
    warnFn: () => {},
    ...overrides,
  });

  return { runtime, calls };
}

test('sender key room runtime distributes once per room and wraps encrypted room payloads canonically', async () => {
  const { runtime, calls } = createRuntime({
    members: [
      { id: 'user-a', npub: 'npub1self' },
      { id: 'user-b', npub: 'npub1valid' },
      { id: 'user-c', npub: 'invalid' },
    ],
  });

  const first = JSON.parse(await runtime.encryptWithSenderKey('room-1', 'hello', [{ id: 'attachment-1' }]));
  const second = JSON.parse(await runtime.encryptWithSenderKey('room-1', 'again'));

  assert.equal(calls.createSKDM.length, 1);
  assert.equal(calls.encryptDirectMessage.length, 1);
  assert.equal(calls.socketEvents.length, 1);
  assert.equal(first.v, 2);
  assert.equal(first.type, 7);
  assert.equal(second.v, 2);
  assert.deepEqual(JSON.parse(calls.groupEncrypt[0][1]), {
    body: 'hello',
    attachments: [{ id: 'attachment-1' }],
    ts: 12345,
  });
  assert.deepEqual(JSON.parse(calls.groupEncrypt[1][1]), {
    body: 'again',
    attachments: [],
    ts: 12345,
  });
  assert.deepEqual(runtime.getStateSnapshot().distributedRooms, ['room-1']);
});

test('sender key room runtime verifies membership before processing incoming distributions', async () => {
  const { runtime, calls } = createRuntime();

  await runtime.processSenderKeyDistribution('user-b', {
    roomId: 'room-1',
    skdm: 'skdm-1',
  });

  assert.deepEqual(calls.api, ['/api/rooms/room-1/members']);
  assert.equal(calls.rememberUsers.length, 1);
  assert.deepEqual(calls.processSKDM, [['user-b', 'skdm-1']]);
  assert.deepEqual(await runtime.decryptRoomSenderKey('room-1', 'user-b', { payload: 'cipher' }), {
    body: 'decrypted body',
    attachments: [],
    ts: 123,
  });
});

test('sender key room runtime warns on partial delivery and keeps board sends non-blocking when delivery fails', async () => {
  const partial = createRuntime({
    members: [
      { id: 'user-a', npub: 'npub1self' },
      { id: 'user-b', npub: 'npub1valid' },
      { id: 'user-c', npub: 'npub1valid' },
    ],
    failRecipients: ['user-c'],
  });

  await partial.runtime.redistributeSenderKey('room-2');
  assert.deepEqual(partial.calls.warnings, [{
    roomId: 'room-2',
    deliveredCount: 1,
    recipientCount: 2,
    failures: ['user-c'],
  }]);

  const failed = createRuntime({
    members: [
      { id: 'user-a', npub: 'npub1self' },
      { id: 'user-b', npub: 'npub1valid' },
    ],
    failRecipients: ['user-b'],
  });

  const encrypted = JSON.parse(await failed.runtime.encryptWithSenderKey('room-3', 'hello later'));

  assert.equal(encrypted.v, 2);
  assert.equal(encrypted.type, 7);
  assert.deepEqual(failed.calls.warnings, [{
    roomId: 'room-3',
    deliveredCount: 0,
    recipientCount: 1,
    failures: ['user-b'],
  }]);
  assert.deepEqual(failed.runtime.getStateSnapshot().distributedRooms, []);
});

test('sender key room runtime only marks rooms distributed after the server accepts sender key delivery', async () => {
  const rejected = createRuntime({
    members: [
      { id: 'user-a', npub: 'npub1self' },
      { id: 'user-b', npub: 'npub1valid' },
    ],
    rejectedRecipients: ['user-b'],
  });

  const encrypted = JSON.parse(await rejected.runtime.encryptWithSenderKey('room-ack', 'hello'));

  assert.equal(encrypted.v, 2);
  assert.equal(encrypted.type, 7);
  assert.equal(rejected.calls.encryptDirectMessage.length, 1);
  assert.equal(rejected.calls.socketEvents.length, 1);
  assert.deepEqual(rejected.calls.warnings, [{
    roomId: 'room-ack',
    deliveredCount: 0,
    recipientCount: 1,
    failures: ['user-b'],
  }]);
  assert.deepEqual(rejected.runtime.getStateSnapshot().distributedRooms, []);
});

test('sender key room runtime rekeys rooms through the shared distribution path', async () => {
  const { runtime, calls } = createRuntime();

  await runtime.encryptWithSenderKey('room-4', 'hello');
  await runtime.rekeyRoom('room-4');

  assert.deepEqual(calls.rekeyRoom, ['room-4']);
  assert.equal(calls.createSKDM.length, 1);
  assert.equal(runtime.getStateSnapshot().distributedRooms.includes('room-4'), true);
});
