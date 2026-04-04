import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECONNECT_SIGNER_TIMEOUT_MS,
  preparePublisherSignerRequest,
  requestPublisherSignature,
  resolvePublisherSignerSession,
  withPublisherSignerTimeout,
} from '../../../client/src/features/nostr/profilePublisherSessionRuntime.mjs';
import { NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS } from '../../../client/src/features/auth/nostrConnectTimeouts.mjs';

test('profile publisher session runtime restores signer state on demand', async () => {
  let signer = null;
  let pubkey = null;
  let reconnectCalls = 0;

  const result = await resolvePublisherSignerSession({
    getSignerFn: () => signer,
    getUserPubkeyFn: () => pubkey,
    reconnectSignerFn: async () => {
      reconnectCalls += 1;
      signer = { signEvent: async (event) => event };
      pubkey = 'pubkey-1';
      return true;
    },
  });

  assert.equal(reconnectCalls, 1);
  assert.equal(result.restored, true);
  assert.equal(result.signer, signer);
  assert.equal(result.pubkey, 'pubkey-1');
});

test('profile publisher session runtime returns no signer when restore fails', async () => {
  const result = await resolvePublisherSignerSession({
    getSignerFn: () => null,
    getUserPubkeyFn: () => null,
    reconnectSignerFn: async () => false,
  });

  assert.equal(result.signer, null);
  assert.equal(result.pubkey, null);
  assert.equal(result.restored, false);
});

test('profile publisher session runtime times out stalled signer reconnect attempts', async () => {
  const result = await resolvePublisherSignerSession({
    getSignerFn: () => null,
    getUserPubkeyFn: () => null,
    reconnectSignerFn: async () => new Promise(() => {}),
    reconnectTimeoutMs: 5,
    withTimeoutFn: withPublisherSignerTimeout,
  });

  assert.equal(result.signer, null);
  assert.equal(result.pubkey, null);
  assert.equal(result.restored, false);
  assert.match(result.error?.message || '', /timed out/i);
});

test('profile publisher reconnect timeout leaves room for bunker reconnect restore', () => {
  assert.ok(
    RECONNECT_SIGNER_TIMEOUT_MS > NIP46_SIGNER_PUBLIC_KEY_TIMEOUT_MS,
    'profile publish reconnect timeout must exceed bunker reconnect restore timeout',
  );
});

test('profile publisher session runtime times out stalled signer approvals', async () => {
  await assert.rejects(
    requestPublisherSignature({
      signer: {
        signEvent: async () => new Promise(() => {}),
      },
      eventTemplate: { kind: 0, content: '{}' },
      timeoutMs: 5,
      withTimeoutFn: withPublisherSignerTimeout,
    }),
    /did not approve|timed out/i,
  );
});

test('profile publisher session runtime fails closed when nip46 ping preflight times out', async () => {
  await assert.rejects(
    preparePublisherSignerRequest({
      signer: {
        ping: async () => new Promise(() => {}),
      },
      loginMode: 'nip46',
      pingTimeoutMs: 5,
      ignorePingFailure: false,
      withTimeoutFn: withPublisherSignerTimeout,
    }),
    /ping|timed out/i,
  );
});

test('profile publisher session runtime only treats nip46 ping as advisory when explicitly requested', async () => {
  const result = await preparePublisherSignerRequest({
    signer: {
      ping: async () => new Promise(() => {}),
    },
    loginMode: 'nip46',
    pingTimeoutMs: 5,
    ignorePingFailure: true,
    withTimeoutFn: withPublisherSignerTimeout,
  });

  assert.equal(result, true);
});
