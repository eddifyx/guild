import test from 'node:test';
import assert from 'node:assert/strict';

import { recoverRoomMessageAfterSenderKeyMiss } from '../../../client/src/features/messaging/messageSenderKeyRecoveryRuntime.mjs';

test('message sender-key recovery runtime retries through sync before returning a decrypted result', async () => {
  const calls = [];
  let attempts = 0;

  const result = await recoverRoomMessageAfterSenderKeyMiss({
    message: {
      room_id: 'room-1',
      sender_id: 'user-b',
    },
    decryptRoomMessageFn: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('missing sender key state');
      return { body: 'decrypted room body' };
    },
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    syncRoomSenderKeysFn: async (...args) => {
      calls.push(['sync', ...args]);
      return 1;
    },
    requestRoomSenderKeyFn: async () => {
      calls.push(['request']);
      return false;
    },
    waitForSenderKeyUpdateFn: async () => {
      calls.push(['wait']);
      return false;
    },
  });

  assert.deepEqual(result, {
    result: { body: 'decrypted room body' },
    lastError: null,
  });
  assert.deepEqual(calls.map(([name]) => name), ['flush', 'sync', 'flush', 'wait', 'sync', 'flush']);
});

test('message sender-key recovery runtime falls back to delivered history before asking for resend', async () => {
  const calls = [];
  let attempts = 0;

  const result = await recoverRoomMessageAfterSenderKeyMiss({
    message: {
      room_id: 'room-2',
      sender_id: 'user-c',
    },
    decryptRoomMessageFn: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('missing sender key state');
      return { body: 'recovered from delivered history' };
    },
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    syncRoomSenderKeysFn: async (...args) => {
      calls.push(['sync', ...args]);
      if (args[1]?.includeDelivered) return 2;
      return 0;
    },
    requestRoomSenderKeyFn: async () => {
      calls.push(['request']);
      return true;
    },
    waitForSenderKeyUpdateFn: async () => {
      calls.push(['wait']);
      return false;
    },
  });

  assert.equal(result.result.body, 'recovered from delivered history');
  assert.equal(result.lastError, null);
  assert.deepEqual(calls.map(([name]) => name), ['flush', 'sync', 'flush', 'wait', 'sync', 'sync', 'flush']);
});

test('message sender-key recovery runtime requests a resend when no local recovery path works', async () => {
  const calls = [];
  let attempts = 0;

  const result = await recoverRoomMessageAfterSenderKeyMiss({
    message: {
      room_id: 'room-3',
      sender_id: 'user-d',
    },
    decryptRoomMessageFn: async () => {
      attempts += 1;
      if (attempts < 2) throw new Error(`missing sender key state:${attempts}`);
      return { body: 'resent recovery' };
    },
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    syncRoomSenderKeysFn: async (...args) => {
      calls.push(['sync', ...args]);
      return 0;
    },
    requestRoomSenderKeyFn: async (...args) => {
      calls.push(['request', ...args]);
      return true;
    },
    waitForSenderKeyUpdateFn: async () => {
      calls.push(['wait']);
      return calls.filter(([name]) => name === 'wait').length === 2;
    },
  });

  assert.equal(result.result.body, 'resent recovery');
  assert.equal(result.lastError, null);
  assert.deepEqual(calls.map(([name]) => name), ['flush', 'sync', 'flush', 'wait', 'sync', 'sync', 'request', 'wait', 'flush']);
});

test('message sender-key recovery runtime returns the last error when every recovery path fails', async () => {
  const calls = [];

  const result = await recoverRoomMessageAfterSenderKeyMiss({
    message: {
      room_id: 'room-4',
      sender_id: 'user-e',
    },
    decryptRoomMessageFn: async () => {
      throw new Error('still missing sender key');
    },
    flushPendingControlMessagesNowFn: async () => calls.push(['flush']),
    syncRoomSenderKeysFn: async (...args) => {
      calls.push(['sync', ...args]);
      return 0;
    },
    requestRoomSenderKeyFn: async (...args) => {
      calls.push(['request', ...args]);
      return false;
    },
    waitForSenderKeyUpdateFn: async () => {
      calls.push(['wait']);
      return false;
    },
  });

  assert.equal(result.result, null);
  assert.match(result.lastError.message, /still missing sender key/);
  assert.deepEqual(calls.map(([name]) => name), ['flush', 'sync', 'flush', 'wait', 'sync', 'sync', 'request']);
});
