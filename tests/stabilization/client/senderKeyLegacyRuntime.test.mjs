import test from 'node:test';
import assert from 'node:assert/strict';

import { createSenderKeyLegacyRuntime } from '../../../client/src/features/crypto/senderKeyLegacyRuntime.mjs';

const encoder = new TextEncoder();

function encodeBytes(value) {
  return Uint8Array.from(Buffer.from(String(value), 'utf8'));
}

function decodeBytes(value) {
  return Buffer.from(value).toString('utf8');
}

function concatBytes(...arrays) {
  const totalLength = arrays.reduce((sum, value) => sum + value.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const value of arrays) {
    combined.set(value, offset);
    offset += value.length;
  }
  return combined;
}

function createRuntime(overrides = {}) {
  const saveCalls = [];
  const senderKeyState = overrides.senderKeyState || {
    chainKey: 'seed',
    signingKeyPublic: 'pub',
    iteration: 0,
    skippedKeys: {},
  };
  const keyStore = overrides.keyStore || {
    async getSenderKey() {
      return senderKeyState;
    },
    async saveSenderKey(...args) {
      saveCalls.push(args);
    },
  };

  const runtime = createSenderKeyLegacyRuntime({
    getKeyStoreFn: () => keyStore,
    isV1StoreReadyFn: () => true,
    apiRequestFn: async () => [{ id: 'user-b' }],
    validateLegacySenderKeyPayloadFn: ({ payload }) => ({
      chainKeyBytes: encodeBytes(payload.chainKey),
      signingKeyBytes: encodeBytes(payload.signingKeyPublic),
      iteration: payload.iteration,
    }),
    fromBase64Fn: encodeBytes,
    toBase64Fn: decodeBytes,
    concatBytesFn: concatBytes,
    ed25519VerifyFn: () => true,
    aes256GcmDecryptFn: () => encoder.encode(JSON.stringify({
      body: 'decrypted body',
      attachments: ['attachment-1'],
      ts: 123,
    })),
    hmacSha256Fn: (input, marker) => encodeBytes(`${marker[0]}:${decodeBytes(input)}`),
    maxIteration: 100,
    maxSenderKeySkip: 3,
    ...overrides,
  });

  return {
    runtime,
    senderKeyState,
    saveCalls,
  };
}

test('sender key legacy runtime saves validated V1 sender keys after membership verification', async () => {
  const saved = [];
  const { runtime } = createRuntime({
    keyStore: {
      async getSenderKey() {
        return { iteration: 2 };
      },
      async saveSenderKey(...args) {
        saved.push(args);
      },
    },
  });

  await runtime.processLegacySenderKey('user-b', {
    roomId: 'room-1',
    senderUserId: 'user-b',
    chainKey: 'chain-3',
    signingKeyPublic: 'pub-3',
    iteration: 3,
  });

  assert.deepEqual(saved, [[
    'room-1',
    'user-b',
    {
      chainKey: 'chain-3',
      signingKeyPublic: 'pub-3',
      iteration: 3,
    },
  ]]);
});

test('sender key legacy runtime rejects rollback payloads and unverifiable membership', async () => {
  const { runtime } = createRuntime({
    keyStore: {
      async getSenderKey() {
        return { iteration: 7 };
      },
      async saveSenderKey() {
        throw new Error('should not save');
      },
    },
  });

  await assert.rejects(
    runtime.processLegacySenderKey('user-b', {
      roomId: 'room-1',
      senderUserId: 'user-b',
      chainKey: 'chain-3',
      signingKeyPublic: 'pub-3',
      iteration: 3,
    }),
    /rollback rejected/,
  );

  const membershipRuntime = createRuntime({
    apiRequestFn: async () => {
      throw new Error('network down');
    },
  }).runtime;

  await assert.rejects(
    membershipRuntime.processLegacySenderKey('user-b', {
      roomId: 'room-1',
      senderUserId: 'user-b',
      chainKey: 'chain-3',
      signingKeyPublic: 'pub-3',
      iteration: 3,
    }),
    /could not verify room membership/,
  );
});

test('sender key legacy runtime consumes skipped keys and persists the updated cache', async () => {
  const senderKeyState = {
    chainKey: 'seed',
    signingKeyPublic: 'pub',
    iteration: 4,
    skippedKeys: {
      7: 'message-key-7',
    },
  };
  const { runtime, saveCalls } = createRuntime({ senderKeyState });

  const result = await runtime.decryptLegacySenderKey('room-1', 'user-b', {
    type: 'sender_key',
    skid: 'user-b',
    ct: 'cipher',
    nc: 'nonce',
    sig: 'sig',
    iter: 7,
  });

  assert.equal(result.body, 'decrypted body');
  assert.deepEqual(result.attachments, ['attachment-1']);
  assert.equal(senderKeyState.skippedKeys[7], undefined);
  assert.equal(saveCalls.length, 1);
});

test('sender key legacy runtime restores sender key state when forward decrypt fails', async () => {
  const senderKeyState = {
    chainKey: 'seed',
    signingKeyPublic: 'pub',
    iteration: 0,
    skippedKeys: {
      existing: 'keep-me',
    },
  };
  const { runtime, saveCalls } = createRuntime({
    senderKeyState,
    aes256GcmDecryptFn: () => {
      throw new Error('decrypt failed');
    },
  });

  await assert.rejects(
    runtime.decryptLegacySenderKey('room-1', 'user-b', {
      type: 'sender_key',
      skid: 'user-b',
      ct: 'cipher',
      nc: 'nonce',
      sig: 'sig',
      iter: 2,
    }),
    /decrypt failed/,
  );

  assert.equal(senderKeyState.chainKey, 'seed');
  assert.equal(senderKeyState.iteration, 0);
  assert.deepEqual(senderKeyState.skippedKeys, { existing: 'keep-me' });
  assert.equal(saveCalls.length, 0);
});
