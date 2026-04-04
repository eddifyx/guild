import test from 'node:test';
import assert from 'node:assert/strict';

import { SECURE_STARTUP_EVENT } from '../../../client/src/features/auth/secureStartupState.mjs';
import {
  applyMergedSessionUser,
  clearLocalSessionState,
  logoutSession,
  restoreInitialSessionUser,
} from '../../../client/src/features/auth/authSessionFlow.mjs';

test('restoreInitialSessionUser emits a restore trace for recoverable auth', () => {
  const traces = [];
  const restoredAuth = restoreInitialSessionUser({
    loadStoredAuth: () => ({
      userId: 'user-1',
      token: 'token-1',
      npub: 'npub1builder',
    }),
    pushTrace: (name, payload) => traces.push([name, payload]),
    redactTraceValue: (value) => value ? '<redacted>' : null,
    getSigner: () => ({ type: 'remote' }),
  });

  assert.deepEqual(restoredAuth, {
    userId: 'user-1',
    token: 'token-1',
    npub: 'npub1builder',
  });
  assert.deepEqual(traces, [[
    'session.restore.auth',
    {
      npub: '<redacted>',
      loginMode: null,
      signerAvailable: true,
    },
  ]]);
});

test('applyMergedSessionUser persists only when the merge produces a new user object', () => {
  const calls = [];
  const currentUser = { userId: 'user-1', token: 'token-1' };

  const sameUser = applyMergedSessionUser({
    currentUser,
    updates: { ignored: true },
    mergeSessionUser: () => currentUser,
    persistAuth: (value) => calls.push(value),
  });
  assert.equal(sameUser, currentUser);
  assert.deepEqual(calls, []);

  const nextUser = applyMergedSessionUser({
    currentUser,
    updates: { username: 'Builder' },
    mergeSessionUser: () => ({
      userId: 'user-1',
      token: 'token-1',
      username: 'Builder',
    }),
    persistAuth: (value) => calls.push(value),
  });
  assert.deepEqual(nextUser, {
    userId: 'user-1',
    token: 'token-1',
    username: 'Builder',
  });
  assert.deepEqual(calls, [{
    userId: 'user-1',
    token: 'token-1',
    username: 'Builder',
  }]);
});

test('clearLocalSessionState tears down signer and crypto state before signing out', async () => {
  const calls = [];
  const secureStartupAttemptRef = { current: 3 };

  await clearLocalSessionState({
    secureStartupAttemptRef,
    destroyCryptoState: async () => {
      calls.push('destroyCrypto');
    },
    resetLocalSignalState: async (userId) => {
      calls.push(['resetSignal', userId]);
    },
    currentUser: {
      userId: 'user-7',
    },
    disconnectSigner: async () => {
      calls.push('disconnectSigner');
    },
    clearRecoverableAuth: () => {
      calls.push('clearAuth');
    },
    setUser: (value) => {
      calls.push(['setUser', value]);
    },
    dispatchCryptoState: (event) => {
      calls.push(['dispatch', event]);
    },
  });

  assert.equal(secureStartupAttemptRef.current, 4);
  assert.deepEqual(calls, [
    'destroyCrypto',
    ['resetSignal', 'user-7'],
    'disconnectSigner',
    'clearAuth',
    ['setUser', null],
    ['dispatch', { type: SECURE_STARTUP_EVENT.SIGNED_OUT }],
  ]);
});

test('logoutSession still clears local session when the logout request fails', async () => {
  const calls = [];
  await logoutSession({
    apiRequest: async () => {
      calls.push('api');
      throw new Error('network');
    },
    clearLocalSession: async () => {
      calls.push('clear');
    },
  });

  assert.deepEqual(calls, ['api', 'clear']);
});
