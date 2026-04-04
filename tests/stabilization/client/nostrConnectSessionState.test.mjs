import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activateNsecState,
  buildNsecSigner,
  clearNostrConnectSessionStorage,
  clearPersistedNsec,
  disconnectNostrConnectState,
  loadPersistedNip46Session,
  loadPersistedNsec,
  persistNip46Session,
  persistNsec,
  reconnectNostrConnectState,
} from '../../../client/src/features/auth/nostrConnectSessionState.mjs';

test('activateNsecState and buildNsecSigner expose one canonical local-signer state', async () => {
  const secretKey = new Uint8Array([1, 2, 3]);
  const state = activateNsecState(secretKey, {
    getPublicKeyFn: () => 'pubkey-1',
  });

  assert.deepEqual(state, {
    nsecKey: secretKey,
    userPubkey: 'pubkey-1',
    loginMode: 'nsec',
  });

  const signer = buildNsecSigner(secretKey, {
    finalizeEventFn: (template, key) => ({ ...template, signedWith: key }),
    getPublicKeyFn: () => 'pubkey-1',
    nip04EncryptFn: (_key, peer, text) => `nip04:${peer}:${text}`,
    nip44EncryptFn: (text, conversationKey) => `nip44:${conversationKey}:${text}`,
    getNip44ConversationKeyFn: (_key, peer) => `conv:${peer}`,
  });

  assert.deepEqual(await signer.signEvent({ kind: 1 }), {
    kind: 1,
    signedWith: secretKey,
  });
  assert.equal(await signer.getPublicKey(), 'pubkey-1');
  assert.equal(signer.nip04Encrypt('peer-1', 'hello'), 'nip04:peer-1:hello');
  assert.equal(signer.nip44Encrypt('peer-1', 'hello'), 'nip44:conv:peer-1:hello');
});

test('nostr-connect persistence stores and restores signer state canonically', async () => {
  const storage = new Map();
  const localStorageObject = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  clearNostrConnectSessionStorage({ localStorageObject });
  clearPersistedNsec({ localStorageObject });

  assert.equal(await persistNip46Session(
    { pubkey: 'pub', secret: 'shared-secret', relays: ['wss://relay'] },
    new Uint8Array([1, 2, 3]),
    'user-pubkey-1',
    {
      clearSessionFn: () => clearNostrConnectSessionStorage({ localStorageObject }),
      localStorageObject,
    },
  ), true);

  assert.deepEqual(await loadPersistedNip46Session({
    clearSessionFn: () => clearNostrConnectSessionStorage({ localStorageObject }),
    localStorageObject,
  }), {
    clientSecretKey: new Uint8Array([1, 2, 3]),
    userPubkey: 'user-pubkey-1',
    bunkerPointer: {
      pubkey: 'pub',
      secret: 'shared-secret',
      relays: ['wss://relay'],
    },
  });

  assert.equal(await persistNsec(new Uint8Array([9, 8, 7]), {
    clearNsecFn: () => clearPersistedNsec({ localStorageObject }),
    getPublicKeyFn: () => 'pubkey-1',
    localStorageObject,
  }), true);
  assert.deepEqual(await loadPersistedNsec({
    clearNsecFn: () => clearPersistedNsec({ localStorageObject }),
    localStorageObject,
  }), {
    secretKey: new Uint8Array([9, 8, 7]),
    pubkey: 'pubkey-1',
  });

  clearPersistedNsec({ localStorageObject });
  assert.equal(await loadPersistedNsec({
    clearNsecFn: () => clearPersistedNsec({ localStorageObject }),
    localStorageObject,
  }), null);
});

test('nostr-connect persistence falls back to local storage and migrates legacy signer state when electron persistence is unavailable', async () => {
  const storage = new Map();
  const localStorageObject = {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, value);
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  let electronState = null;
  let allowElectronWrites = false;

  assert.equal(await persistNip46Session(
    { pubkey: 'pub', secret: 'shared-secret-2', relays: ['wss://relay'] },
    new Uint8Array([4, 5, 6]),
    'user-pubkey-2',
    {
      localStorageObject,
      writeSignerStateFn: async (state) => {
        if (!allowElectronWrites) return false;
        electronState = state;
        return true;
      },
    },
  ), true);

  assert.equal(electronState, null);

  const restoredFromLegacy = await loadPersistedNip46Session({
    localStorageObject,
    readSignerStateFn: async () => null,
    writeSignerStateFn: async (state) => {
      electronState = state;
      allowElectronWrites = true;
      return true;
    },
  });

  assert.deepEqual(restoredFromLegacy, {
    clientSecretKey: new Uint8Array([4, 5, 6]),
    userPubkey: 'user-pubkey-2',
    bunkerPointer: {
      pubkey: 'pub',
      secret: 'shared-secret-2',
      relays: ['wss://relay'],
    },
  });
  assert.deepEqual(electronState, {
    mode: 'nip46',
    clientSecretKey: 'BAUG',
    userPubkey: 'user-pubkey-2',
    bunkerPointer: {
      pubkey: 'pub',
      secret: 'shared-secret-2',
      relays: ['wss://relay'],
    },
  });
  assert.equal(storage.has('nostr_signer_state'), false);
});

test('nostr-connect persistence preserves the last good signer state when a rewrite fails', async () => {
  let storedState = null;

  assert.equal(await persistNip46Session(
    { pubkey: 'pub', secret: 'shared-secret-3', relays: ['wss://relay'] },
    new Uint8Array([1, 2, 3]),
    'user-pubkey-1',
    {
      writeSignerStateFn: async (state) => {
        storedState = state;
        return true;
      },
    },
  ), true);

  assert.equal(await persistNip46Session(
    { pubkey: 'pub-2', relays: ['wss://relay-2'] },
    new Uint8Array([7, 8, 9]),
    {
      clearSessionFn: () => {
        storedState = null;
      },
      writeSignerStateFn: async () => false,
      localStorageObject: {
        getItem() {
          return null;
        },
        setItem() {
          throw new Error('storage disabled');
        },
        removeItem() {},
      },
    },
  ), false);

  assert.deepEqual(storedState, {
    mode: 'nip46',
    clientSecretKey: 'AQID',
    userPubkey: 'user-pubkey-1',
    bunkerPointer: {
      pubkey: 'pub',
      secret: 'shared-secret-3',
      relays: ['wss://relay'],
    },
  });
});

test('reconnectNostrConnectState prefers nsec restores and falls back to nip46 sessions', async () => {
  const traces = [];
  const resolveCalls = [];
  const nsecResult = await reconnectNostrConnectState({
    loadNsecFn: async () => ({
      secretKey: new Uint8Array([1]),
      pubkey: 'pubkey-1',
    }),
    loadSessionFn: async () => {
      throw new Error('should not load session');
    },
    buildSignerFromSessionFn: async () => {
      throw new Error('should not build signer');
    },
    resolveSignerPublicKeyFn: async () => {
      throw new Error('should not resolve signer');
    },
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
  });

  assert.deepEqual(nsecResult, {
    restored: true,
    signer: null,
    clientSecretKey: null,
    userPubkey: 'pubkey-1',
    nsecKey: new Uint8Array([1]),
    loginMode: 'nsec',
  });

  const nip46Result = await reconnectNostrConnectState({
    loadNsecFn: async () => null,
    loadSessionFn: async () => ({
      clientSecretKey: new Uint8Array([9, 9]),
      userPubkey: 'user-pub',
      bunkerPointer: { pubkey: 'bunker-pub', relays: ['wss://relay'] },
    }),
    buildSignerFromSessionFn: async () => ({ id: 'signer-1' }),
    resolveSignerPublicKeyFn: async (_signer, options) => {
      resolveCalls.push(options);
      return 'pubkey-2';
    },
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
  });

  assert.deepEqual(nip46Result, {
    restored: true,
    signer: { id: 'signer-1' },
    clientSecretKey: new Uint8Array([9, 9]),
    userPubkey: 'pubkey-2',
    nsecKey: null,
    loginMode: 'nip46',
  });

  assert.equal(
    traces.some(([eventName]) => eventName === 'session.reconnect.nip46.success'),
    true,
  );
  assert.deepEqual(resolveCalls, [{
    source: 'session_reconnect',
    knownPubkey: null,
    timeoutMessage: 'Timed out waiting for the signer to restore its public key.',
  }]);
});

test('reconnectNostrConnectState and disconnectNostrConnectState clean up failed or closed sessions safely', async () => {
  const traces = [];
  const zeroed = [];
  const cleared = [];
  const failureResult = await reconnectNostrConnectState({
    loadNsecFn: async () => null,
    loadSessionFn: async () => ({
      clientSecretKey: new Uint8Array([7, 7]),
      bunkerPointer: { pubkey: 'bunker-pub', relays: [] },
    }),
    buildSignerFromSessionFn: async () => {
      throw new Error('boom');
    },
    resolveSignerPublicKeyFn: async () => 'pubkey-2',
    pushTraceFn: (...args) => traces.push(args),
    summarizeErrorFn: (error) => ({ message: error.message }),
    zeroKeyFn: (value) => zeroed.push(value),
  });

  assert.equal(failureResult.restored, false);
  assert.equal(zeroed.length, 1);

  const disconnected = await disconnectNostrConnectState({
    signer: { id: 'signer-1' },
    clientSecretKey: new Uint8Array([3]),
    nsecKey: new Uint8Array([4]),
    loginMode: 'nip46',
    userPubkey: 'pubkey-3',
    closeSignerFn: async () => {
      cleared.push('closed');
    },
    zeroKeyFn: (value) => cleared.push(value),
    clearSessionFn: () => cleared.push('clear-session'),
    clearNsecFn: () => cleared.push('clear-nsec'),
    pushTraceFn: (...args) => traces.push(args),
    redactTraceValueFn: (value) => `redacted:${value}`,
  });

  assert.deepEqual(disconnected, {
    signer: null,
    clientSecretKey: null,
    nsecKey: null,
    userPubkey: null,
    loginMode: null,
  });
  assert.equal(cleared.includes('closed'), true);
  assert.equal(cleared.includes('clear-session'), true);
  assert.equal(cleared.includes('clear-nsec'), true);
  assert.equal(
    traces.some(([eventName]) => eventName === 'session.disconnect'),
    true,
  );
});
