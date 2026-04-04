import test from 'node:test';
import assert from 'node:assert/strict';

import { createSocketPendingControlQueueRuntime } from '../../../client/src/features/crypto/socketPendingControlQueueRuntime.mjs';

test('socket pending control queue runtime dedupes duplicate entries and retries retryable failures', async () => {
  const processed = [];
  const acknowledged = [];
  let shouldFail = true;

  const runtime = createSocketPendingControlQueueRuntime({
    processEncryptedControlMessageFn: async (entry) => {
      processed.push(entry);
      if (shouldFail) {
        const err = new Error('E2E not initialized yet');
        err.retryable = true;
        throw err;
      }
      return { type: 'sender_key_distribution', roomId: entry.roomId };
    },
    acknowledgeProcessedControlMessageFn: async (...args) => {
      acknowledged.push(args);
    },
    nowFn: () => 10_000,
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  runtime.queuePendingControlMessage({ id: 'dist-1', fromUserId: 'user-1', envelope: 'cipher', roomId: 'room-1' });
  runtime.queuePendingControlMessage({ id: 'dist-1', fromUserId: 'user-1', envelope: 'cipher', roomId: 'room-1' });

  await runtime.flushPendingControlMessagesNow();
  assert.equal(runtime.getStateSnapshot().pendingControlMessageCount, 1);

  shouldFail = false;
  await runtime.flushPendingControlMessagesNow();

  assert.equal(processed.length, 2);
  assert.equal(acknowledged.length, 1);
  assert.equal(runtime.getStateSnapshot().pendingControlMessageCount, 0);
});

test('socket pending control queue runtime drops expired entries and warns on non-retryable failures', async () => {
  const warnings = [];
  const acknowledged = [];
  let now = 100_000;

  const runtime = createSocketPendingControlQueueRuntime({
    processEncryptedControlMessageFn: async () => {
      throw new Error('fatal failure');
    },
    acknowledgeProcessedControlMessageFn: async (...args) => {
      acknowledged.push(args);
    },
    nowFn: () => now,
    warnFn: (...args) => warnings.push(args),
    setIntervalFn: () => 1,
    clearIntervalFn: () => {},
  });

  runtime.queuePendingControlMessage({
    id: 'old-1',
    fromUserId: 'user-2',
    envelope: 'cipher-old',
    receivedAt: 1,
  });
  await runtime.flushPendingControlMessagesNow();

  runtime.queuePendingControlMessage({
    id: 'fatal-1',
    fromUserId: 'user-3',
    envelope: 'cipher-fatal',
    receivedAt: now,
  });
  now += 1;
  await runtime.flushPendingControlMessagesNow();

  assert.equal(acknowledged.length, 1);
  assert.equal(runtime.getStateSnapshot().pendingControlMessageCount, 0);
  assert.equal(warnings.length, 2);
});
