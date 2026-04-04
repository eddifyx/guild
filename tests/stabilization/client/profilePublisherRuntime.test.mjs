import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fetchRelayProfile,
  parseBlossomErrorResponse,
  publishEventToRelays,
  publishSignedEvent,
  signBlossomAuthHeader,
} from '../../../client/src/features/nostr/profilePublisherRuntime.mjs';

test('profile publisher runtime publishes through the shared relay pool helpers', async () => {
  const published = [];
  const pool = {
    publish(relays, event) {
      published.push({ relays, event });
      return [Promise.resolve({ ok: true })];
    },
  };

  await publishEventToRelays({
    pool,
    relays: ['wss://relay.example'],
    event: { id: 'evt-1' },
  });

  assert.deepEqual(published, [{
    relays: ['wss://relay.example'],
    event: { id: 'evt-1' },
  }]);

  const closes = [];
  class PoolCtor {
    publish(relays, event) {
      published.push({ relays, event });
      return [Promise.resolve({ ok: true })];
    }
    close(relays) {
      closes.push(relays);
    }
  }

  const result = await publishSignedEvent({
    poolCtor: PoolCtor,
    relays: ['wss://relay.example'],
    event: { id: 'evt-2' },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(closes, [['wss://relay.example']]);
});

test('profile publisher runtime times out relay publishes instead of hanging forever', async () => {
  const never = new Promise(() => {});
  const publishResult = await publishSignedEvent({
    poolCtor: class {
      publish() {
        return [never];
      }
      close() {}
    },
    relays: ['wss://relay.example'],
    event: { id: 'evt-timeout' },
    publishEventFn: ({ pool, relays, event }) => publishEventToRelays({
      pool,
      relays,
      event,
      timeoutMs: 10,
    }),
  });

  assert.equal(publishResult.ok, false);
  assert.match(publishResult.error, /Timed out publishing to relays/);
});

test('profile publisher runtime fetches relay profiles and parses blossom errors canonically', async () => {
  class PoolCtor {
    async get() {
      return { content: JSON.stringify({ name: 'guild user' }) };
    }
    close() {}
  }

  const profile = await fetchRelayProfile({
    poolCtor: PoolCtor,
    relays: ['wss://relay.example'],
    pubkey: 'pubkey-1',
  });

  assert.deepEqual(profile, { name: 'guild user' });

  const parsedJsonError = await parseBlossomErrorResponse({
    status: 400,
    text: async () => JSON.stringify({ error: 'bad file' }),
  });
  const parsedTextError = await parseBlossomErrorResponse({
    status: 500,
    text: async () => 'server unhappy',
  });
  const parsedEmptyError = await parseBlossomErrorResponse({
    status: 418,
    text: async () => '',
  });

  assert.equal(parsedJsonError, 'bad file');
  assert.equal(parsedTextError, 'server unhappy');
  assert.equal(parsedEmptyError, 'Upload failed (418)');
});

test('profile publisher runtime signs blossom auth headers through the shared token encoder', async () => {
  const signed = [];
  const header = await signBlossomAuthHeader({
    signer: {
      async signEvent(event) {
        signed.push(event);
        return { ...event, id: 'evt-1' };
      },
    },
    pubkey: 'pubkey-1',
    action: 'media',
    sha256: 'hash-1',
    content: 'Upload profile image',
    nowMs: 1_700_000_000_000,
    encodeTokenFn: (value) => `encoded:${value}`,
  });

  assert.match(header, /^Nostr encoded:/);
  assert.equal(signed[0].kind, 24242);
  assert.equal(signed[0].pubkey, 'pubkey-1');
  assert.equal(signed[0].created_at, 1_700_000_000);
  assert.deepEqual(signed[0].tags, [
    ['t', 'media'],
    ['x', 'hash-1'],
    ['expiration', '1700000300'],
    ['server', 'blossom.nostr.build'],
  ]);
});
