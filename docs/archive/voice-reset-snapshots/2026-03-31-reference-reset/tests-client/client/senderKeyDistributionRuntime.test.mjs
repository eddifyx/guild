import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSenderKeyDistributionPayload,
  emitSenderKeyDistributionWarning,
  runWithConcurrency,
  selectSenderKeyRecipients,
  summarizeSenderKeyDistributionResults,
  validateLegacySenderKeyPayload,
  validateSenderKeyDistributionPayload,
} from '../../../client/src/features/crypto/senderKeyDistributionRuntime.mjs';

test('sender key distribution runtime selects recipients and builds canonical payloads', () => {
  const recipients = selectSenderKeyRecipients([
    { id: 'user-1', npub: 'npub1self' },
    { id: 'user-2', npub: 'npub1valid' },
    { id: 'user-3', npub: 'invalid' },
  ], 'user-1');

  assert.deepEqual(recipients, [{ id: 'user-2', npub: 'npub1valid' }]);
  assert.equal(buildSenderKeyDistributionPayload({
    roomId: 'room-1',
    senderUserId: 'user-1',
    skdmBase64: 'skdm-1',
  }), JSON.stringify({
    type: 'sender_key_distribution',
    v: 2,
    roomId: 'room-1',
    senderUserId: 'user-1',
    skdm: 'skdm-1',
  }));
});

test('sender key distribution runtime summarizes deliveries and emits warnings through the shared detail shape', () => {
  assert.deepEqual(
    summarizeSenderKeyDistributionResults([
      { ok: true, member: { id: 'user-1' } },
      { ok: false, member: { username: 'Alice' } },
      { ok: false, member: { id: 'user-3' } },
    ]),
    {
      deliveredCount: 1,
      failures: ['Alice', 'user-3'],
    },
  );

  const events = [];
  class TestCustomEvent {
    constructor(name, init) {
      this.name = name;
      this.detail = init.detail;
    }
  }

  emitSenderKeyDistributionWarning({
    roomId: 'room-1',
    deliveredCount: 2,
    recipientCount: 3,
    failures: ['user-4'],
    windowObj: {
      CustomEvent: TestCustomEvent,
      dispatchEvent: (event) => events.push(event),
    },
  });

  assert.equal(events[0].name, 'room-sender-key-distribution-warning');
  assert.deepEqual(events[0].detail, {
    roomId: 'room-1',
    deliveredCount: 2,
    recipientCount: 3,
    failures: ['user-4'],
  });
});

test('sender key distribution runtime validates payload versions and legacy key material', () => {
  assert.deepEqual(validateSenderKeyDistributionPayload({
    fromUserId: 'user-1',
    payload: { type: 'other' },
  }), { handled: false });

  assert.deepEqual(validateSenderKeyDistributionPayload({
    fromUserId: 'user-1',
    payload: {
      type: 'sender_key_distribution',
      senderUserId: 'user-1',
      v: 2,
      skdm: 'skdm-1',
    },
  }), { handled: true, version: 2 });

  assert.deepEqual(validateSenderKeyDistributionPayload({
    fromUserId: 'user-1',
    payload: {
      type: 'sender_key_distribution',
      senderUserId: 'user-1',
      chainKey: 'chain',
      signingKeyPublic: 'signing',
    },
  }), { handled: true, version: 1 });

  assert.throws(() => validateSenderKeyDistributionPayload({
    fromUserId: 'user-1',
    payload: {
      type: 'sender_key_distribution',
      senderUserId: 'user-2',
      v: 2,
      skdm: 'skdm-1',
    },
  }), /sender mismatch/);

  const fromBase64Fn = (value) => {
    if (value === 'good') return new Uint8Array(32);
    return new Uint8Array(3);
  };

  assert.deepEqual(validateLegacySenderKeyPayload({
    payload: {
      chainKey: 'good',
      signingKeyPublic: 'good',
      iteration: 7,
    },
    fromBase64Fn,
    maxIteration: 100,
  }), {
    chainKeyBytes: new Uint8Array(32),
    signingKeyBytes: new Uint8Array(32),
    iteration: 7,
  });

  assert.throws(() => validateLegacySenderKeyPayload({
    payload: {
      chainKey: 'bad',
      signingKeyPublic: 'good',
      iteration: 7,
    },
    fromBase64Fn,
    maxIteration: 100,
  }), /invalid key lengths/);

  assert.throws(() => validateLegacySenderKeyPayload({
    payload: {
      chainKey: 'good',
      signingKeyPublic: 'good',
      iteration: 1000,
    },
    fromBase64Fn,
    maxIteration: 100,
  }), /invalid iteration/);
});

test('sender key distribution runtime respects the configured concurrency limit', async () => {
  const active = [];
  let maxConcurrency = 0;

  const results = await runWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    active.push(value);
    maxConcurrency = Math.max(maxConcurrency, active.length);
    await Promise.resolve();
    active.splice(active.indexOf(value), 1);
    return value * 2;
  });

  assert.deepEqual(results, [2, 4, 6, 8]);
  assert.equal(maxConcurrency <= 2, true);
});
