import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNostrSignerParams,
  buildTracingPool,
  instrumentSigner,
  resolveSignerPublicKey,
  waitForNip46RelayCooldown,
  withTimeout,
  zeroNostrConnectKey,
} from '../../../client/src/features/auth/nostrConnectRuntime.mjs';

test('zeroNostrConnectKey clears secret bytes in place', () => {
  const key = new Uint8Array([1, 2, 3, 4]);

  zeroNostrConnectKey(key);

  assert.deepEqual(Array.from(key), [0, 0, 0, 0]);
});

test('buildNostrSignerParams emits auth challenges through one canonical callback', () => {
  const traces = [];
  const emitted = [];
  const warnings = [];
  const signerParams = buildNostrSignerParams({
    eventName: 'nostr-auth',
    pushTraceFn: (...args) => traces.push(args),
    emitAuthChallengeFn: (...args) => emitted.push(args),
    warnFn: (...args) => warnings.push(args),
  });

  signerParams.onauth('https://example.com/challenge');

  assert.deepEqual(traces, [
    ['signer.onauth', { url: 'https://example.com/challenge' }, 'warn'],
  ]);
  assert.deepEqual(emitted, [
    ['https://example.com/challenge', { eventName: 'nostr-auth' }],
  ]);
  assert.equal(warnings.length, 1);
});

test('resolveSignerPublicKey reuses known account pubkeys without querying the signer', async () => {
  const traces = [];
  let called = false;

  const pubkey = await resolveSignerPublicKey({
    getPublicKey: async () => {
      called = true;
      return 'should-not-run';
    },
  }, {
    source: 'unit',
    knownPubkey: 'a'.repeat(64),
    timeoutMessage: 'timeout',
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
  });

  assert.equal(pubkey, 'a'.repeat(64));
  assert.equal(called, false);
  assert.deepEqual(traces, [
    [
      'signer.getPublicKey.skipped',
      {
        source: 'unit',
        reason: 'using_known_user_pubkey',
        pubkey: `redacted:${'a'.repeat(64)}`,
      },
    ],
  ]);
});

test('withTimeout rejects unresolved work when the timeout fires', async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, 'timed out', {
      setTimeoutFn: (fn) => {
        fn();
        return 1;
      },
      clearTimeoutFn: () => {},
    }),
    /timed out/,
  );
});

test('waitForNip46RelayCooldown traces and awaits the injected sleeper', async () => {
  const traces = [];
  const sleeps = [];

  await waitForNip46RelayCooldown({
    stage: 'after_connect',
    delayMs: 250,
    pushTraceFn: (...args) => traces.push(args),
    sleepFn: async (ms) => {
      sleeps.push(ms);
    },
  });

  assert.deepEqual(traces, [
    ['relay.request.cooldown', { stage: 'after_connect', delayMs: 250 }],
  ]);
  assert.deepEqual(sleeps, [250]);
});

test('buildTracingPool wraps subscription events and close handlers with canonical traces', () => {
  const traces = [];

  class FakePool {
    constructor(options) {
      this.options = options;
      this.subscribeCalls = [];
    }

    subscribe(relays, filter, params = {}, ...rest) {
      this.subscribeCalls.push({ relays, filter, params, rest });
      return { id: 'sub-1' };
    }
  }

  const pool = buildTracingPool({
    source: 'qr_session',
    SimplePoolCtor: FakePool,
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
  });

  const result = pool.subscribe(
    ['wss://relay.example'],
    { kinds: [24133], authors: ['pub'], '#p': ['peer'] },
    {
      onevent: (event) => {
        traces.push(['user.onevent', event.id]);
      },
      onclose: (reason) => {
        traces.push(['user.onclose', reason]);
      },
    },
  );

  assert.deepEqual(result, { id: 'sub-1' });

  const [{ params }] = pool.subscribeCalls;
  params.onevent({
    id: 'event-1',
    kind: 24133,
    created_at: 123,
    pubkey: 'abc',
    tags: [['p', 'peer']],
    content: 'payload',
  });
  params.onclose('closed');

  assert.equal(
    traces.some(([eventName]) => eventName === 'relay.subscription.event'),
    true,
  );
  assert.equal(
    traces.some(([eventName]) => eventName === 'relay.subscription.closed'),
    true,
  );
  assert.equal(
    traces.some((entry) => entry[0] === 'user.onevent' && entry[1] === 'event-1'),
    true,
  );
  assert.equal(
    traces.some((entry) => entry[0] === 'user.onclose' && entry[1] === 'closed'),
    true,
  );
});

test('instrumentSigner emits canonical request, response, and error traces', async () => {
  const traces = [];
  let now = 100;

  const signer = instrumentSigner({
    ping: async () => 'pong',
    sendRequest: async () => {
      throw new Error('boom');
    },
  }, {
    source: 'trace-test',
    pushTraceFn: (...args) => traces.push(args),
    summarizeErrorFn: (error) => ({ message: error.message }),
    summarizeSignerArgsFn: (methodName, args) => ({
      methodName,
      argsCount: args.length,
    }),
    summarizeSignerResultFn: (methodName, result) => ({
      methodName,
      result,
    }),
    nowFn: () => {
      now += 7;
      return now;
    },
  });

  assert.equal(await signer.ping(), 'pong');
  await assert.rejects(() => signer.sendRequest('ping'), /boom/);

  assert.deepEqual(traces, [
    ['signer.ping.request', { source: 'trace-test', methodName: 'ping', argsCount: 0 }],
    ['signer.ping.response', { source: 'trace-test', durationMs: 7, methodName: 'ping', result: 'pong' }],
    ['signer.sendRequest.request', { source: 'trace-test', methodName: 'sendRequest', argsCount: 1 }],
    ['signer.sendRequest.error', { source: 'trace-test', durationMs: 7, error: { message: 'boom' } }, 'error'],
  ]);
});
