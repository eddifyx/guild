import test from 'node:test';
import assert from 'node:assert/strict';

import { publishProfile } from '../../../client/src/nostr/profilePublisher.js';

test('publishProfile proactively refreshes nip46 signers before requesting a profile signature', async () => {
  const prepareCalls = [];
  const signCalls = [];
  const eventPubkeys = [];
  let reconnectCalls = 0;
  let activeSigner = { id: 'stale-signer' };

  const result = await publishProfile(
    { name: 'Loda', about: 'Nightslayer' },
    {
      getSignerFn: () => activeSigner,
      getUserPubkeyFn: () => 'pubkey-1',
      getLoginModeFn: () => 'nip46',
      reconnectSignerFn: async () => {
        reconnectCalls += 1;
        activeSigner = { id: 'fresh-signer' };
        return true;
      },
      resolvePublisherSignerSessionFn: async () => ({
        signer: activeSigner,
        pubkey: 'pubkey-1',
        error: null,
      }),
      waitForNip46RelayCooldownFn: async () => {},
      preparePublisherSignerRequestFn: async ({ signer, loginMode }) => {
        prepareCalls.push([signer.id, loginMode]);
      },
      requestPublisherSignatureFn: async ({ signer, eventTemplate }) => {
        signCalls.push(signer.id);
        eventPubkeys.push(eventTemplate.pubkey);
        return { ...eventTemplate, id: 'evt-1' };
      },
      publishSignedEventFn: async ({ event }) => ({ ok: true, id: event.id }),
    },
  );

  assert.deepEqual(prepareCalls, [
    ['fresh-signer', 'nip46'],
  ]);
  assert.deepEqual(signCalls, ['fresh-signer']);
  assert.deepEqual(eventPubkeys, ['pubkey-1']);
  assert.equal(reconnectCalls, 1);
  assert.equal(result.ok, true);
});

test('publishProfile retries once after a nip46 signer goes stale even when proactive refresh cannot restore it', async () => {
  const prepareCalls = [];
  const signCalls = [];
  let reconnectCalls = 0;
  let activeSigner = { id: 'stale-signer' };

  const result = await publishProfile(
    { name: 'Loda', about: 'Nightslayer' },
    {
      getSignerFn: () => activeSigner,
      getUserPubkeyFn: () => 'pubkey-1',
      getLoginModeFn: () => 'nip46',
      reconnectSignerFn: async () => {
        reconnectCalls += 1;
        if (reconnectCalls >= 2) {
          activeSigner = { id: 'fresh-signer' };
          return true;
        }
        return false;
      },
      resolvePublisherSignerSessionFn: async () => ({
        signer: activeSigner,
        pubkey: 'pubkey-1',
        error: null,
      }),
      waitForNip46RelayCooldownFn: async () => {},
      preparePublisherSignerRequestFn: async ({ signer, loginMode }) => {
        prepareCalls.push([signer.id, loginMode]);
      },
      requestPublisherSignatureFn: async ({ signer, eventTemplate }) => {
        signCalls.push([signer.id, eventTemplate.pubkey]);
        if (signer.id === 'stale-signer') {
          throw new Error('Your signer connected, but it did not approve the profile publish request in time.');
        }
        return { ...eventTemplate, id: 'evt-1' };
      },
      publishSignedEventFn: async ({ event }) => ({ ok: true, id: event.id }),
    },
  );

  assert.deepEqual(prepareCalls, [
    ['stale-signer', 'nip46'],
    ['fresh-signer', 'nip46'],
  ]);
  assert.deepEqual(signCalls, [
    ['stale-signer', 'pubkey-1'],
    ['fresh-signer', 'pubkey-1'],
  ]);
  assert.equal(reconnectCalls, 2);
  assert.equal(result.ok, true);
});

test('publishProfile returns a signing error when reconnect cannot recover a timed out nip46 signer', async () => {
  let signCalls = 0;

  const result = await publishProfile(
    { name: 'Loda' },
    {
      getSignerFn: () => ({ id: 'signer-1' }),
      getUserPubkeyFn: () => 'pubkey-1',
      getLoginModeFn: () => 'nip46',
      reconnectSignerFn: async () => false,
      resolvePublisherSignerSessionFn: async () => ({
        signer: { id: 'signer-1' },
        pubkey: 'pubkey-1',
        error: null,
      }),
      waitForNip46RelayCooldownFn: async () => {},
      preparePublisherSignerRequestFn: async () => true,
      requestPublisherSignatureFn: async () => {
        signCalls += 1;
        throw new Error('Your signer connected, but it did not approve the profile publish request in time.');
      },
      publishSignedEventFn: async () => ({ ok: true }),
    },
  );

  assert.equal(signCalls, 1);
  assert.equal(result.ok, false);
  assert.match(result.error, /did not approve/i);
});
