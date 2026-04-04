import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVoiceKeyDistributionPayload,
  createRetryableVoiceKeyError,
  distributeVoiceKeyRuntime,
  processDecryptedVoiceKeyRuntime,
} from '../../../client/src/features/crypto/voiceKeyDistributionRuntime.mjs';

test('voice key distribution runtime builds the canonical DM payload', () => {
  const payload = buildVoiceKeyDistributionPayload({
    channelId: 'voice-1',
    key: Uint8Array.from([1, 2, 3]),
    epoch: 9,
    toBase64Fn: () => 'AQID',
  });

  assert.equal(payload, JSON.stringify({
    type: 'voice_key_distribution',
    channelId: 'voice-1',
    key: 'AQID',
    epoch: 9,
  }));
});

test('voice key distribution runtime skips the local user and surfaces failed deliveries', async () => {
  const sent = [];

  await assert.rejects(
    distributeVoiceKeyRuntime({
      channelId: 'voice-2',
      participantUserIds: ['self', 'user-1', 'user-2'],
      key: Uint8Array.from([9, 9, 9]),
      epoch: 4,
      socket: { id: 'socket-1' },
      myUserId: 'self',
      toBase64Fn: () => 'CQkJ',
      encryptDirectMessageFn: async (userId, payload) => ({ userId, payload }),
      emitVoiceKeyEnvelopeFn: async (_socket, userId, envelope) => {
        sent.push([userId, envelope.payload]);
        if (userId === 'user-2') {
          throw new Error('delivery failed');
        }
      },
      logErrorFn: () => {},
    }),
    /user-2/,
  );

  assert.deepEqual(sent, [
    ['user-1', JSON.stringify({
      type: 'voice_key_distribution',
      channelId: 'voice-2',
      key: 'CQkJ',
      epoch: 4,
    })],
    ['user-2', JSON.stringify({
      type: 'voice_key_distribution',
      channelId: 'voice-2',
      key: 'CQkJ',
      epoch: 4,
    })],
  ]);
});

test('voice key distribution runtime marks channel and participant readiness failures as retryable', () => {
  assert.throws(
    () => processDecryptedVoiceKeyRuntime({
      fromUserId: 'user-3',
      payload: { type: 'voice_key_distribution', channelId: 'voice-3', key: 'abc', epoch: 2 },
      channelId: null,
      participantUserIds: new Set(['user-3']),
      setVoiceKeyFn: () => true,
    }),
    (error) => error?.retryable === true && /local channel was ready/.test(error?.message),
  );

  assert.throws(
    () => processDecryptedVoiceKeyRuntime({
      fromUserId: 'user-3',
      payload: { type: 'voice_key_distribution', channelId: 'voice-3', key: 'abc', epoch: 2 },
      channelId: 'voice-3',
      participantUserIds: new Set(),
      setVoiceKeyFn: () => true,
    }),
    (error) => error?.retryable === true && /participant list was ready/.test(error?.message),
  );

  const retryable = createRetryableVoiceKeyError('try again later');
  assert.equal(retryable.retryable, true);
});

test('voice key distribution runtime accepts matching payloads and ignores mismatched channels', () => {
  const calls = [];

  const accepted = processDecryptedVoiceKeyRuntime({
    fromUserId: 'user-4',
    payload: { type: 'voice_key_distribution', channelId: 'voice-4', key: 'xyz', epoch: 8 },
    channelId: 'voice-4',
    participantUserIds: new Set(['user-4']),
    setVoiceKeyFn: (key, epoch) => {
      calls.push([key, epoch]);
      return true;
    },
  });
  const ignored = processDecryptedVoiceKeyRuntime({
    fromUserId: 'user-4',
    payload: { type: 'voice_key_distribution', channelId: 'voice-5', key: 'xyz', epoch: 8 },
    channelId: 'voice-4',
    participantUserIds: new Set(['user-4']),
    setVoiceKeyFn: () => false,
  });

  assert.equal(accepted, true);
  assert.equal(ignored, false);
  assert.deepEqual(calls, [['xyz', 8]]);
});

test('voice key distribution runtime normalizes participant and channel identifiers before accepting a key', () => {
  const calls = [];

  const accepted = processDecryptedVoiceKeyRuntime({
    fromUserId: 7,
    payload: { type: 'voice_key_distribution', channelId: 42, key: 'normalized', epoch: 5 },
    channelId: '42',
    participantUserIds: new Set(['7']),
    setVoiceKeyFn: (key, epoch) => {
      calls.push([key, epoch]);
      return true;
    },
  });

  assert.equal(accepted, true);
  assert.deepEqual(calls, [['normalized', 5]]);
});
