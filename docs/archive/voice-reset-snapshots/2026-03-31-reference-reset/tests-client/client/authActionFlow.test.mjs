import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthActions } from '../../../client/src/features/auth/authActionFlow.mjs';

test('nostrLogin connects signer-backed auth and clears local session on failure', async () => {
  const calls = [];
  const actions = createAuthActions({
    connectWithBunkerURI: async (input) => {
      calls.push(['connect', input]);
      return { pubkey: 'pubkey-1', npub: 'npub-1' };
    },
    getSigner: () => null,
    authenticateWithServer: async () => {
      throw new Error('should not reach authenticate');
    },
    completeAuthenticatedLogin: async () => {
      throw new Error('should not reach completion');
    },
    clearLocalSession: async () => {
      calls.push(['clear']);
    },
    pushTrace: (name, payload, level = 'info') => {
      calls.push(['trace', name, payload, level]);
    },
    summarizeError: (error) => error.message,
  });

  await assert.rejects(() => actions.nostrLogin('bunker://test'), /Signer not connected/);

  assert.deepEqual(calls, [
    ['trace', 'login.nostr_bunker.start', {}, 'info'],
    ['connect', 'bunker://test'],
    ['trace', 'login.nostr_bunker.error', { error: 'Signer not connected' }, 'error'],
    ['clear'],
  ]);
});

test('nsecLogin activates the key and completes authenticated login', async () => {
  const calls = [];
  const secretKey = new Uint8Array([1, 2, 3]);
  const actions = createAuthActions({
    decodeNsec: (value) => {
      calls.push(['decode', value]);
      return {
        secretKey,
        pubkey: 'pubkey-1',
        npub: 'npub-1',
      };
    },
    activateNsec: async (value) => {
      calls.push(['activate', value]);
    },
    authenticateWithServer: async (pubkey, npub, signerOrSecretKey) => {
      calls.push(['authenticate', pubkey, npub, signerOrSecretKey]);
      return { userId: 'user-1', token: 'token-1' };
    },
    completeAuthenticatedLogin: async (authData) => {
      calls.push(['complete', authData]);
      return { ...authData, complete: true };
    },
    pushTrace: (name, payload, level = 'info') => {
      calls.push(['trace', name, payload, level]);
    },
    redactTraceValue: (value) => value ? '<redacted>' : null,
    summarizeError: (error) => error.message,
  });

  const result = await actions.nsecLogin('nsec-test');

  assert.deepEqual(result, {
    userId: 'user-1',
    token: 'token-1',
    complete: true,
  });
  assert.deepEqual(calls, [
    ['decode', 'nsec-test'],
    ['activate', secretKey],
    ['trace', 'login.nsec.start', { pubkey: '<redacted>', npub: '<redacted>' }, 'info'],
    ['authenticate', 'pubkey-1', 'npub-1', secretKey],
    ['complete', { userId: 'user-1', token: 'token-1' }],
  ]);
});

test('createAccount finalizes the published profile and updates the session user', async () => {
  const calls = [];
  const secretKey = new Uint8Array([9, 9, 9]);
  const actions = createAuthActions({
    decodeNsec: () => ({
      secretKey,
      pubkey: 'pubkey-1',
      npub: 'npub-1',
    }),
    activateNsec: async (value) => {
      calls.push(['activate', value]);
    },
    authenticateWithServer: async () => ({ userId: 'user-1', token: 'token-1' }),
    completeAuthenticatedLogin: async (authData) => {
      calls.push(['complete', authData]);
      return authData;
    },
    finalizeCreatedAccountProfile: async (options) => {
      calls.push(['finalizeProfile', {
        authData: options.authData,
        profile: options.profile,
        profileImageFile: options.profileImageFile,
      }]);
      return {
        authData: {
          userId: 'user-1',
          token: 'token-1',
          username: 'Builder',
        },
        profile: {
          name: 'Builder',
        },
      };
    },
    uploadImage: async () => {
      throw new Error('unused');
    },
    publishProfile: async () => {
      throw new Error('unused');
    },
    apiRequest: async () => {
      throw new Error('unused');
    },
    persistAuth: () => {
      throw new Error('unused');
    },
    setUser: (value) => {
      calls.push(['setUser', value]);
    },
    pushTrace: (name, payload, level = 'info') => {
      calls.push(['trace', name, payload, level]);
    },
    redactTraceValue: (value) => value ? '<redacted>' : null,
    summarizeError: (error) => error.message,
  });

  const result = await actions.createAccount({
    nsec: 'nsec-test',
    profile: { name: 'Builder' },
    profileImageFile: { name: 'pfp.png' },
  });

  assert.deepEqual(result, {
    authData: {
      userId: 'user-1',
      token: 'token-1',
      username: 'Builder',
    },
    profile: {
      name: 'Builder',
    },
  });
  assert.deepEqual(calls, [
    ['activate', secretKey],
    ['trace', 'login.nsec_create.start', {
      pubkey: '<redacted>',
      npub: '<redacted>',
      hasProfile: true,
      hasProfileImageFile: true,
    }, 'info'],
    ['complete', { userId: 'user-1', token: 'token-1' }],
    ['finalizeProfile', {
      authData: { userId: 'user-1', token: 'token-1' },
      profile: { name: 'Builder' },
      profileImageFile: { name: 'pfp.png' },
    }],
    ['setUser', {
      userId: 'user-1',
      token: 'token-1',
      username: 'Builder',
    }],
  ]);
});

test('nsecLogin fails fast when signer persistence cannot be established', async () => {
  const calls = [];
  const actions = createAuthActions({
    decodeNsec: () => ({
      secretKey: new Uint8Array([1, 2, 3]),
      pubkey: 'pubkey-1',
      npub: 'npub-1',
    }),
    activateNsec: async () => {
      throw new Error('Failed to persist signer session');
    },
    clearLocalSession: async () => {
      calls.push(['clear']);
    },
    pushTrace: (name, payload, level = 'info') => {
      calls.push(['trace', name, payload, level]);
    },
    summarizeError: (error) => error.message,
  });

  await assert.rejects(() => actions.nsecLogin('nsec-test'), /Failed to persist signer session/);

  assert.deepEqual(calls, [
    ['trace', 'login.nsec.error', { error: 'Failed to persist signer session' }, 'error'],
    ['clear'],
  ]);
});
