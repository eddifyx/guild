import test from 'node:test';
import assert from 'node:assert/strict';

import {
  connectWithBunkerFlow,
  createNostrConnectSessionDescriptor,
  resetNostrConnectSignerState,
  waitForNostrConnectSessionConnection,
} from '../../../client/src/features/auth/nostrConnectFlow.mjs';

test('resetNostrConnectSignerState closes the previous signer and zeroes the old key', async () => {
  const calls = [];

  await resetNostrConnectSignerState({
    signer: { id: 'signer-1' },
    clientSecretKey: new Uint8Array([1, 2]),
    closeSignerFn: async (signer) => {
      calls.push(['close', signer.id]);
    },
    zeroKeyFn: (key) => {
      calls.push(['zero', Array.from(key)]);
    },
  });

  assert.deepEqual(calls, [
    ['close', 'signer-1'],
    ['zero', [1, 2]],
  ]);
});

test('connectWithBunkerFlow resets prior state, validates input, and returns a canonical connected result', async () => {
  const traces = [];
  const resets = [];
  const persisted = [];

  await assert.rejects(
    connectWithBunkerFlow({
      bunkerInput: 'bad',
      currentSigner: null,
      currentClientSecretKey: null,
      parseBunkerInputFn: async () => null,
      pushTraceFn: (...args) => traces.push(args),
      redactTraceValueFn: (value) => `redacted:${value}`,
      generateSecretKeyFn: () => new Uint8Array([9]),
      createSignerFromBunkerFn: async () => ({ id: 'signer-1' }),
      waitForCooldownFn: async () => {},
      resolveSignerPublicKeyFn: async () => 'pubkey-1',
      persistSessionFn: async () => {},
      nip19EncodeFn: (value) => `npub:${value}`,
      resetSignerStateFn: async (options) => resets.push(options),
    }),
    /Invalid bunker URI or NIP-05 identifier/,
  );

  const result = await connectWithBunkerFlow({
    bunkerInput: 'bunker://ok',
    currentSigner: { id: 'old-signer' },
    currentClientSecretKey: new Uint8Array([1, 2]),
    parseBunkerInputFn: async () => ({
      pubkey: 'bunker-pub',
      relays: ['wss://relay'],
    }),
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
    generateSecretKeyFn: () => new Uint8Array([7, 7]),
    createSignerFromBunkerFn: async (clientSecretKey, bunkerPointer) => ({
      id: 'signer-1',
      clientSecretKey,
      bunkerPointer,
    }),
    waitForCooldownFn: async (stage) => traces.push(['cooldown', stage]),
    resolveSignerPublicKeyFn: async (signer, options) => {
      traces.push(['resolve', signer.id, options.knownPubkey]);
      return 'pubkey-1';
    },
    persistSessionFn: async (bunkerPointer, clientSecretKey, userPubkey) => {
      persisted.push([bunkerPointer, Array.from(clientSecretKey), userPubkey]);
      return true;
    },
    nip19EncodeFn: (value) => `npub:${value}`,
    resetSignerStateFn: async (options) => resets.push(options),
  });

  assert.equal(resets.length, 2);
  assert.deepEqual(result, {
    signer: {
      id: 'signer-1',
      clientSecretKey: new Uint8Array([7, 7]),
      bunkerPointer: {
        pubkey: 'bunker-pub',
        relays: ['wss://relay'],
      },
    },
    clientSecretKey: new Uint8Array([7, 7]),
    userPubkey: 'pubkey-1',
    loginMode: 'nip46',
    result: {
      npub: 'npub:pubkey-1',
      pubkey: 'pubkey-1',
    },
  });
  assert.deepEqual(persisted, [[
    { pubkey: 'bunker-pub', relays: ['wss://relay'] },
    [7, 7],
    'pubkey-1',
  ]]);
  assert.equal(
    traces.some(([eventName]) => eventName === 'bunker.connect.success'),
    true,
  );

  await assert.rejects(
    connectWithBunkerFlow({
      bunkerInput: 'bunker://ok',
      currentSigner: null,
      currentClientSecretKey: null,
      parseBunkerInputFn: async () => ({
        pubkey: 'bunker-pub',
        relays: ['wss://relay'],
      }),
      generateSecretKeyFn: () => new Uint8Array([7, 7]),
      createSignerFromBunkerFn: async () => ({ id: 'signer-2' }),
      waitForCooldownFn: async () => {},
      resolveSignerPublicKeyFn: async () => 'pubkey-1',
      persistSessionFn: async () => false,
      nip19EncodeFn: (value) => `npub:${value}`,
      resetSignerStateFn: async () => {},
    }),
    /Failed to persist signer session/,
  );
});

test('createNostrConnectSessionDescriptor emits a stable QR session descriptor', () => {
  const traces = [];
  const generated = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])];

  const descriptor = createNostrConnectSessionDescriptor({
    generateSecretKeyFn: () => generated.shift(),
    getPublicKeyFn: (key) => `pub:${Array.from(key).join(',')}`,
    bytesToHexFn: (key) => `hex:${Array.from(key).join(',')}`,
    createNostrConnectURIFn: (options) => JSON.stringify(options),
    relays: ['wss://relay'],
    perms: ['get_public_key'],
    name: '/guild',
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
    hasAbortSignal: true,
  });

  assert.deepEqual(descriptor, {
    clientSecretKey: new Uint8Array([1, 2, 3]),
    clientPubkey: 'pub:1,2,3',
    secret: 'hex:4,5,6',
    relays: ['wss://relay'],
    uri: JSON.stringify({
      clientPubkey: 'pub:1,2,3',
      relays: ['wss://relay'],
      secret: 'hex:4,5,6',
      perms: ['get_public_key'],
      name: '/guild',
    }),
  });
  assert.deepEqual(traces, [[
    'qr.session.created',
    {
      clientPubkey: 'redacted:pub:1,2,3',
      relays: ['wss://relay'],
      perms: ['get_public_key'],
      hasAbortSignal: true,
    },
  ]]);
});

test('waitForNostrConnectSessionConnection finalizes QR connections and cleans up abort/finalize failures', async () => {
  const traces = [];
  const persisted = [];
  const closed = [];

  const result = await waitForNostrConnectSessionConnection({
    clientSecretKey: new Uint8Array([8, 8]),
    uri: 'nostrconnect://session',
    abortSignal: { aborted: false },
    onConnected: () => traces.push(['connected-callback']),
    createSignerFromURIFn: async () => ({
      id: 'signer-1',
      bp: { pubkey: 'bunker-pub', secret: 'qr-secret', relays: ['wss://relay'] },
    }),
    resolveSignerPublicKeyFn: async (_signer, options) => {
      traces.push(['qr-resolve', options.knownPubkey]);
      return 'pubkey-1';
    },
    persistSessionFn: async (pointer, key, userPubkey) => {
      persisted.push([pointer, Array.from(key), userPubkey]);
      return true;
    },
    nip19EncodeFn: (value) => `npub:${value}`,
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
    summarizeErrorFn: (error) => ({ message: error.message }),
    closeSignerFn: async (signer) => closed.push(signer?.id),
  });

  assert.equal(result.result.npub, 'npub:pubkey-1');
  assert.deepEqual(persisted, [[
    { pubkey: 'bunker-pub', secret: 'qr-secret', relays: ['wss://relay'] },
    [8, 8],
    'pubkey-1',
  ]]);
  assert.equal(
    traces.some((entry) => entry[0] === 'qr-resolve' && entry[1] == null),
    true,
  );
  assert.equal(traces.some(([eventName]) => eventName === 'qr.wait_for_connection.ready'), true);

  await assert.rejects(
    waitForNostrConnectSessionConnection({
      clientSecretKey: new Uint8Array([9]),
      uri: 'nostrconnect://session',
      abortSignal: { aborted: true },
      createSignerFromURIFn: async () => ({ id: 'signer-2', bp: {} }),
      resolveSignerPublicKeyFn: async () => 'pubkey-2',
      persistSessionFn: async () => {},
      nip19EncodeFn: (value) => value,
      pushTraceFn: (...args) => traces.push(args),
      summarizeErrorFn: (error) => ({ message: error.message }),
      closeSignerFn: async (signer) => closed.push(signer?.id),
    }),
    /QR login was cancelled/,
  );

  await assert.rejects(
    waitForNostrConnectSessionConnection({
      clientSecretKey: new Uint8Array([10]),
      uri: 'nostrconnect://session',
      abortSignal: { aborted: false },
      createSignerFromURIFn: async () => ({ id: 'signer-3', bp: {} }),
      resolveSignerPublicKeyFn: async () => {
        throw new Error('finalize failed');
      },
      persistSessionFn: async () => {},
      nip19EncodeFn: (value) => value,
      pushTraceFn: (...args) => traces.push(args),
      summarizeErrorFn: (error) => ({ message: error.message }),
      closeSignerFn: async (signer) => closed.push(signer?.id),
    }),
    /finalize failed/,
  );

  await assert.rejects(
    waitForNostrConnectSessionConnection({
      clientSecretKey: new Uint8Array([11]),
      uri: 'nostrconnect://session',
      abortSignal: { aborted: false },
      createSignerFromURIFn: async () => ({
        id: 'signer-4',
        bp: { pubkey: 'bunker-pub', relays: ['wss://relay'] },
      }),
      resolveSignerPublicKeyFn: async () => 'pubkey-4',
      persistSessionFn: async () => false,
      nip19EncodeFn: (value) => value,
      pushTraceFn: (...args) => traces.push(args),
      summarizeErrorFn: (error) => ({ message: error.message }),
      closeSignerFn: async (signer) => closed.push(signer?.id),
    }),
    /Failed to persist signer session/,
  );

  assert.equal(closed.includes('signer-2'), true);
  assert.equal(closed.includes('signer-3'), true);
  assert.equal(closed.includes('signer-4'), true);
});
