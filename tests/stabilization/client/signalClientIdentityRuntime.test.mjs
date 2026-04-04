import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientIdentityRuntime } from '../../../client/src/features/crypto/signalClientIdentityRuntime.mjs';

test('signal client identity runtime resolves expected npubs from current session and directory state', async () => {
  const runtime = createSignalClientIdentityRuntime({
    getCurrentUserIdFn: () => 'self-user',
    getCurrentUserNpubFn: () => 'npub-self',
    getKnownNpubFn: (userId) => (userId === 'other-user' ? 'npub-other' : null),
  });

  assert.equal(await runtime.resolveExpectedNpub('self-user'), 'npub-self');
  assert.equal(await runtime.resolveExpectedNpub('other-user'), 'npub-other');
  await assert.rejects(
    runtime.resolveExpectedNpub('missing-user'),
    (err) => err?.retryable === true && /Nostr identity/.test(err?.message),
  );
});

test('signal client identity runtime quarantines sessions when trusted npub resolution fails', async () => {
  const calls = [];
  const runtime = createSignalClientIdentityRuntime({
    getKnownNpubFn: () => null,
    signalCrypto: {
      deleteSession: async (userId) => calls.push(['delete-session', userId]),
    },
  });

  await assert.rejects(
    runtime.requireTrustedNpub('user-1', { quarantineSession: true }),
    /Nostr identity/,
  );
  assert.deepEqual(calls, [['delete-session', 'user-1']]);
});

test('signal client identity runtime validates and reconciles remote identities through the signal bridge', async () => {
  const calls = [];
  const runtime = createSignalClientIdentityRuntime({
    getKnownNpubFn: () => 'npub-remote',
    getStableBundleFn: (record) => ({ identityKey: record.identityKey }),
    verifyBundleAttestationFn: () => true,
    signalCrypto: {
      getIdentityState: async () => {
        calls.push('get-state');
        return { status: 'untrusted', verified: false };
      },
      approveIdentity: async (userId, deviceId, identityKey, options) => {
        calls.push(['approve', userId, deviceId, identityKey, options.verified]);
      },
      deleteSession: async () => {
        calls.push('delete');
      },
    },
  });

  const result = await runtime.verifyAndApproveIdentity('user-2', 4, {
    identityKey: 'identity-key',
    bundleSignatureEvent: { id: 'attestation' },
  });

  assert.equal(result.identityKey, 'identity-key');
  assert.equal(result.deviceId, 4);
  assert.equal(result.trustState, 'untrusted');
  assert.deepEqual(calls, [
    'get-state',
    ['approve', 'user-2', 4, 'identity-key', false],
    'get-state',
  ]);
});

test('signal client identity runtime reconciles local device registration through stable bundle and device records', async () => {
  const calls = [];
  const runtime = createSignalClientIdentityRuntime({
    getStableLocalBundleFn: async () => ({ identityKey: 'local-key' }),
    fetchDeviceIdentityRecordsFn: async (userId) => {
      calls.push(['fetch-identities', userId]);
      return [{ deviceId: 5, identityKey: 'other-key' }];
    },
    signalCrypto: {
      setDeviceId: async (deviceId) => {
        calls.push(['set-device-id', deviceId]);
        return deviceId;
      },
      allocateDeviceId: async (excluded) => {
        calls.push(['allocate-device-id', excluded]);
        return 9;
      },
    },
  });

  const result = await runtime.reconcileLocalDeviceRegistration(
    { userId: 'self-user' },
    5,
  );

  assert.equal(result.deviceId, 9);
  assert.deepEqual(calls, [
    ['fetch-identities', 'self-user'],
    ['allocate-device-id', [5]],
  ]);
});

test('signal client identity runtime bootstraps verified sessions through the signal bridge with current session state', async () => {
  const calls = [];
  const runtime = createSignalClientIdentityRuntime({
    getCurrentUserIdFn: () => 'self-user',
    fetchPreKeyBundleFn: async (userId, deviceId) => ({
      userId,
      deviceId,
      identityKey: 'bundle-key',
      bundleSignatureEvent: { id: 'attestation' },
    }),
    getKnownNpubFn: () => 'npub-remote',
    getStableBundleFn: (record) => ({ identityKey: record.identityKey }),
    verifyBundleAttestationFn: () => true,
    signalCrypto: {
      getIdentityState: async () => ({ status: 'trusted', verified: true }),
      approveIdentity: async (userId, deviceId, identityKey, options) => {
        calls.push(['approve', userId, deviceId, identityKey, options.verified]);
      },
      deleteSession: async (userId, deviceId) => {
        calls.push(['delete', userId, deviceId]);
      },
      processBundle: async (userId, deviceId, bundle) => {
        calls.push(['process', userId, deviceId, bundle.identityKey]);
      },
    },
  });

  const normalizedDeviceId = await runtime.bootstrapSessionFromVerifiedBundle('user-3', 2);

  assert.equal(normalizedDeviceId, 2);
  assert.deepEqual(calls, [
    ['process', 'user-3', 2, 'bundle-key'],
  ]);
});

test('signal client identity runtime fans out sibling device discovery from the current user', async () => {
  const calls = [];
  const runtime = createSignalClientIdentityRuntime({
    getCurrentUserIdFn: () => 'self-user',
    getCurrentDeviceIdFn: () => 3,
    fetchDeviceIdentityRecordsCachedFn: async (userId) => [
      { deviceId: 3, identityKey: 'self-key', bundleSignatureEvent: { id: 'self-attestation' } },
      { deviceId: 7, identityKey: 'sibling-key', bundleSignatureEvent: { id: 'sibling-attestation' } },
    ],
    getKnownNpubFn: () => 'npub-self',
    getStableBundleFn: (record) => ({ identityKey: record.identityKey }),
    verifyBundleAttestationFn: () => true,
    signalCrypto: {
      getIdentityState: async (userId, deviceId) => {
        calls.push(['get-state', userId, deviceId]);
        return { status: 'trusted', verified: true };
      },
      approveIdentity: async () => {
        calls.push('approve');
      },
      deleteSession: async () => {
        calls.push('delete');
      },
    },
  });

  const siblings = await runtime.listVerifiedSiblingDevicesBestEffort();

  assert.deepEqual(siblings, [{
    deviceId: 7,
    identityKey: 'sibling-key',
    bundleSignatureEvent: { id: 'sibling-attestation' },
  }]);
  assert.deepEqual(calls, []);
});
