import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionReconnectSigner,
  createNostrConnectRuntime,
} from '../../../client/src/features/auth/nostrConnectModuleRuntime.mjs';

test('nostr connect module runtime exposes a stable wrapper API over shared facade state', async () => {
  const persistedStates = [];
  let storedSignerState = null;
  const runtime = createNostrConnectRuntime({
    signerStatePersistence: {
      async signerStateSet(signerState) {
        storedSignerState = signerState;
        persistedStates.push(signerState);
        return true;
      },
      async signerStateGet() {
        return storedSignerState;
      },
      async signerStateClear() {
        storedSignerState = null;
        return true;
      },
    },
    facadeFactory: ({ state }) => ({
      connectWithBunkerURI: async (bunkerInput) => {
        state.signer = { id: 'signer-1' };
        state.clientSecretKey = new Uint8Array([1, 2]);
        state.userPubkey = 'pubkey-1';
        state.loginMode = 'nip46';
        return { npub: 'npub-1', pubkey: 'pubkey-1', bunkerInput };
      },
      reconnect: async () => {
        state.userPubkey = 'pubkey-2';
        state.loginMode = 'nsec';
        state.nsecKey = new Uint8Array([3, 4]);
        return true;
      },
      createNostrConnectSession: ({ abortSignal }) => ({
        uri: 'nostrconnect://session',
        waitForConnection: async () => {
          state.signer = { id: 'signer-2' };
          state.clientSecretKey = new Uint8Array([5, 6]);
          state.userPubkey = 'pubkey-3';
          state.loginMode = 'nip46';
          return { npub: 'npub-3', pubkey: 'pubkey-3', abortSignal };
        },
      }),
      activateNsec: (secretKey) => {
        state.nsecKey = secretKey;
        state.userPubkey = 'pubkey-nsec';
        state.loginMode = 'nsec';
      },
      disconnect: async () => {
        state.signer = null;
        state.clientSecretKey = null;
        state.userPubkey = null;
        state.nsecKey = null;
        state.loginMode = null;
      },
    }),
  });

  assert.equal(runtime.getAuthChallengeEventName(), 'nostr-connect-auth-challenge');
  assert.equal(runtime.isConnected(), false);

  const connected = await runtime.connectWithBunkerURI('bunker://remote');
  assert.equal(connected.pubkey, 'pubkey-1');
  assert.equal(runtime.getUserPubkey(), 'pubkey-1');
  assert.equal(runtime.getLoginMode(), 'nip46');
  assert.equal(runtime.isConnected(), true);

  await runtime.activateNsec(new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 10)));
  assert.equal(runtime.getLoginMode(), 'nsec');
  assert.equal(runtime.getSigner()?.signEvent instanceof Function, true);

  const session = runtime.createNostrConnectSession({ abortSignal: 'abort-signal' });
  assert.equal(session.uri, 'nostrconnect://session');
  const sessionResult = await session.waitForConnection();
  assert.equal(sessionResult.pubkey, 'pubkey-3');

  const secretKey = new Uint8Array(Array.from({ length: 32 }, (_, index) => index + 1));
  await runtime.persistNsec(secretKey);
  const restoredNsec = await runtime.loadNsec();
  assert.deepEqual(restoredNsec.secretKey, secretKey);
  assert.equal(typeof restoredNsec.pubkey, 'string');
  assert.equal(persistedStates.at(-1).mode, 'nsec');

  await runtime.disconnect();
  assert.equal(runtime.getUserPubkey(), null);
  assert.equal(runtime.isConnected(), false);
});

test('nostr connect module runtime requests the signer permissions needed for profiles and blossom auth', async () => {
  let capturedConstants = null;

  createNostrConnectRuntime({
    facadeFactory: ({ constants }) => {
      capturedConstants = constants;
      return {
        connectWithBunkerURI: async () => ({}),
        reconnect: async () => false,
        createNostrConnectSession: () => ({ uri: '', waitForConnection: async () => ({}) }),
        activateNsec: () => {},
        disconnect: async () => {},
      };
    },
  });

  assert.equal(Array.isArray(capturedConstants?.perms), true);
  assert.equal(capturedConstants.perms.includes('sign_event:0'), true);
  assert.equal(capturedConstants.perms.includes('sign_event:24242'), true);
});

test('session reconnect signer re-authorizes QR sessions that persisted a bunker secret', async () => {
  const state = {};
  const connectCalls = [];
  const signer = {
    connect: async () => {
      connectCalls.push('connect');
    },
  };

  const restoredSigner = await buildSessionReconnectSigner({
    clientSecretKey: new Uint8Array([1, 2, 3]),
    bunkerPointer: {
      pubkey: 'bunker-pub',
      secret: 'qr-secret',
      relays: ['wss://nos.lol'],
    },
  }, {
    state,
    BunkerSignerCtor: {
      fromBunker(clientSecretKey, bunkerPointer, options) {
        assert.deepEqual(clientSecretKey, new Uint8Array([1, 2, 3]));
        assert.deepEqual(bunkerPointer, {
          pubkey: 'bunker-pub',
          secret: 'qr-secret',
          relays: ['wss://nos.lol'],
        });
        assert.equal(Array.isArray(options.pool?.seenSources), true);
        return signer;
      },
    },
    SimplePoolCtor: function FakePool() {},
    buildSignerParamsFn: () => ({ marker: 'params' }),
    instrumentSignerFn: (currentSigner) => currentSigner,
    buildSignerTraceOptionsFn: () => ({}),
    buildTracingPoolFn: ({ source }) => ({ seenSources: [source] }),
    pushTraceFn: () => {},
    redactTraceValueFn: (value) => value,
  });

  assert.equal(restoredSigner, signer);
  assert.deepEqual(connectCalls, ['connect']);
  assert.deepEqual(state.clientSecretKey, new Uint8Array([1, 2, 3]));
});

test('session reconnect signer skips bunker re-authorization when no QR secret was persisted', async () => {
  const connectCalls = [];
  const signer = {
    connect: async () => {
      connectCalls.push('connect');
    },
  };

  const restoredSigner = await buildSessionReconnectSigner({
    clientSecretKey: new Uint8Array([4, 5, 6]),
    bunkerPointer: {
      pubkey: 'bunker-pub',
      relays: ['wss://nos.lol'],
    },
  }, {
    state: {},
    BunkerSignerCtor: {
      fromBunker() {
        return signer;
      },
    },
    SimplePoolCtor: function FakePool() {},
    buildSignerParamsFn: () => ({ marker: 'params' }),
    instrumentSignerFn: (currentSigner) => currentSigner,
    buildSignerTraceOptionsFn: () => ({}),
    buildTracingPoolFn: ({ source }) => ({ seenSources: [source] }),
    pushTraceFn: () => {},
    redactTraceValueFn: (value) => value,
  });

  assert.equal(restoredSigner, signer);
  assert.deepEqual(connectCalls, []);
});

test('session reconnect signer surfaces bunker re-authorization timeouts', async () => {
  await assert.rejects(
    buildSessionReconnectSigner({
      clientSecretKey: new Uint8Array([7, 8, 9]),
      bunkerPointer: {
        pubkey: 'bunker-pub',
        secret: 'qr-secret',
        relays: ['wss://nos.lol'],
      },
    }, {
      state: {},
      BunkerSignerCtor: {
        fromBunker() {
          return {
            connect: async () => 'connected',
          };
        },
      },
      SimplePoolCtor: function FakePool() {},
      buildSignerParamsFn: () => ({ marker: 'params' }),
      instrumentSignerFn: (currentSigner) => currentSigner,
      buildSignerTraceOptionsFn: () => ({}),
      buildTracingPoolFn: ({ source }) => ({ seenSources: [source] }),
      withTimeoutFn: async () => {
        throw new Error('Timed out waiting for the signer to restore its bunker session.');
      },
      pushTraceFn: () => {},
      redactTraceValueFn: (value) => value,
      summarizeErrorFn: (error) => ({ message: error.message }),
    }),
    /Timed out waiting for the signer to restore its bunker session\./,
  );
});
