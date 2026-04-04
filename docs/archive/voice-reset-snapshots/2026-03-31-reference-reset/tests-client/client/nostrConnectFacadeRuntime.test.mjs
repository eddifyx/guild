import test from 'node:test';
import assert from 'node:assert/strict';

import { createNostrConnectFacadeRuntime } from '../../../client/src/features/auth/nostrConnectFacadeRuntime.mjs';

function createState() {
  return {
    signer: null,
    clientSecretKey: null,
    userPubkey: null,
    nsecKey: null,
    loginMode: null,
  };
}

test('nostr connect facade runtime applies bunker connections to shared module state', async () => {
  const state = createState();
  const calls = [];

  const runtime = createNostrConnectFacadeRuntime({
    state,
    deps: {
      connectWithBunkerFlowFn: async (options) => {
        calls.push(['connect', options.currentSigner, options.currentClientSecretKey, options.bunkerInput]);
        return {
          signer: { id: 'signer-1' },
          clientSecretKey: new Uint8Array([1, 2, 3]),
          userPubkey: 'pubkey-1',
          loginMode: 'nip46',
          result: { npub: 'npub-1', pubkey: 'pubkey-1' },
        };
      },
    },
  });

  const result = await runtime.connectWithBunkerURI('bunker://remote');

  assert.deepEqual(calls, [['connect', null, null, 'bunker://remote']]);
  assert.equal(state.signer.id, 'signer-1');
  assert.equal(state.userPubkey, 'pubkey-1');
  assert.equal(state.loginMode, 'nip46');
  assert.deepEqual(result, { npub: 'npub-1', pubkey: 'pubkey-1' });
});

test('nostr connect facade runtime restores or clears shared module state during reconnect', async () => {
  const restoredState = createState();
  const restoredRuntime = createNostrConnectFacadeRuntime({
    state: restoredState,
    deps: {
      reconnectNostrConnectStateFn: async () => ({
        restored: true,
        signer: { id: 'signer-2' },
        clientSecretKey: new Uint8Array([4, 5, 6]),
        nsecKey: new Uint8Array([7, 8, 9]),
        userPubkey: 'pubkey-2',
        loginMode: 'nsec',
      }),
    },
  });

  assert.equal(await restoredRuntime.reconnect(), true);
  assert.equal(restoredState.signer.id, 'signer-2');
  assert.equal(restoredState.loginMode, 'nsec');
  assert.deepEqual(Array.from(restoredState.nsecKey), [7, 8, 9]);

  const clearedState = {
    signer: { id: 'signer-3' },
    clientSecretKey: new Uint8Array([1]),
    userPubkey: 'pubkey-3',
    nsecKey: new Uint8Array([2]),
    loginMode: 'nip46',
  };
  const warnings = [];
  const clearedRuntime = createNostrConnectFacadeRuntime({
    state: clearedState,
    deps: {
      reconnectNostrConnectStateFn: async () => ({
        restored: false,
        error: new Error('relay offline'),
      }),
      consoleWarnFn: (...args) => warnings.push(args),
    },
  });

  assert.equal(await clearedRuntime.reconnect(), false);
  assert.equal(clearedState.signer, null);
  assert.equal(clearedState.clientSecretKey, null);
  assert.equal(clearedState.userPubkey, null);
  assert.equal(clearedState.nsecKey, null);
  assert.equal(clearedState.loginMode, null);
  assert.equal(warnings[0][0], '[NIP-46] Reconnect failed:');
});

test('nostr connect facade runtime creates qr sessions through one shared state path', async () => {
  const state = {
    signer: { close: async () => {} },
    clientSecretKey: new Uint8Array([9, 9, 9]),
    userPubkey: 'pubkey-old',
    nsecKey: null,
    loginMode: 'nip46',
  };
  const calls = [];

  const runtime = createNostrConnectFacadeRuntime({
    state,
    deps: {
      resetSignerStateFn: async (options) => {
        calls.push(['reset', Array.from(options.clientSecretKey)]);
      },
      createNostrConnectSessionDescriptorFn: () => ({
        uri: 'nostrconnect://session',
        clientSecretKey: new Uint8Array([1, 2, 3]),
      }),
      waitForNostrConnectSessionConnectionFn: async (options) => {
        calls.push(['wait', options.uri, options.abortSignal]);
        return {
          signer: { id: 'signer-4' },
          clientSecretKey: new Uint8Array([1, 2, 3]),
          userPubkey: 'pubkey-4',
          loginMode: 'nip46',
          result: { npub: 'npub-4', pubkey: 'pubkey-4' },
        };
      },
      createSignerFromURIFn: async () => ({ id: 'uri-signer' }),
      persistSessionFn: async () => {},
      nip19EncodeFn: (value) => value,
      pushTraceFn: () => {},
      redactTraceValueFn: (value) => value,
      summarizeErrorFn: (error) => error,
      resolveSignerPublicKeyFn: async () => 'pubkey-4',
      generateSecretKeyFn: () => new Uint8Array([1, 2, 3]),
      getPublicKeyFn: () => 'pubkey-4',
      bytesToHexFn: () => '010203',
      createNostrConnectURIFn: () => 'nostrconnect://session',
    },
    constants: {
      relays: ['wss://relay.example'],
      perms: ['get_public_key'],
      appName: '/guild',
    },
  });

  const session = runtime.createNostrConnectSession({
    abortSignal: 'abort-signal',
    onConnected: () => {},
  });

  assert.equal(session.uri, 'nostrconnect://session');
  assert.equal(state.signer, null);
  assert.equal(state.clientSecretKey, null);
  assert.equal(state.userPubkey, null);
  assert.equal(state.loginMode, null);

  const result = await session.waitForConnection();

  assert.deepEqual(calls, [
    ['reset', [9, 9, 9]],
    ['wait', 'nostrconnect://session', 'abort-signal'],
  ]);
  assert.equal(state.signer.id, 'signer-4');
  assert.equal(state.userPubkey, 'pubkey-4');
  assert.deepEqual(result, { npub: 'npub-4', pubkey: 'pubkey-4' });
});

test('nostr connect facade runtime applies nsec activation and disconnect cleanup canonically', async () => {
  const state = createState();
  const calls = [];

  const runtime = createNostrConnectFacadeRuntime({
    state,
    deps: {
      activateNsecStateFn: () => ({
        nsecKey: new Uint8Array([3, 2, 1]),
        userPubkey: 'pubkey-5',
        loginMode: 'nsec',
      }),
      disconnectNostrConnectStateFn: async (options) => {
        calls.push(['disconnect', options.userPubkey, options.loginMode]);
        return {
          signer: null,
          clientSecretKey: null,
          nsecKey: null,
          userPubkey: null,
          loginMode: null,
        };
      },
      clearSessionFn: () => {},
      clearNsecFn: () => {},
    },
  });

  runtime.activateNsec(new Uint8Array([3, 2, 1]));
  assert.equal(state.userPubkey, 'pubkey-5');
  assert.equal(state.loginMode, 'nsec');

  await runtime.disconnect();
  assert.deepEqual(calls, [['disconnect', 'pubkey-5', 'nsec']]);
  assert.equal(state.userPubkey, null);
  assert.equal(state.nsecKey, null);
});
