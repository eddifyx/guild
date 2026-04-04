import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadOrCreateSignalBundleAttestation,
  resolveStableLocalSignalBundle,
  uploadSignedSignalBundle,
} from '../../../client/src/features/crypto/signalBundleRuntime.mjs';

test('signal bundle runtime resolves a stable local bundle through injected deps', async () => {
  const stable = await resolveStableLocalSignalBundle({
    getBundleFn: async () => ({ identityKey: 'raw' }),
    getStableBundleFn: (bundle) => ({ ...bundle, stable: true }),
  });

  assert.deepEqual(stable, { identityKey: 'raw', stable: true });
});

test('signal bundle runtime prefers cached attestations and stores newly signed ones', async () => {
  const calls = [];
  const cached = await loadOrCreateSignalBundleAttestation({
    userId: 'user-1',
    npub: 'npub-1',
    stableBundle: { identityKey: 'key-1' },
    loadCachedBundleAttestationFn: () => ({ id: 'cached' }),
    signBundleAttestationFn: async () => ({ id: 'signed' }),
    storeBundleAttestationFn: () => calls.push('store'),
  });
  assert.deepEqual(cached, { id: 'cached' });

  const signed = await loadOrCreateSignalBundleAttestation({
    userId: 'user-1',
    npub: 'npub-1',
    stableBundle: { identityKey: 'key-1' },
    loadCachedBundleAttestationFn: () => null,
    signBundleAttestationFn: async () => ({ id: 'signed' }),
    storeBundleAttestationFn: (userId, event) => calls.push([userId, event.id]),
  });
  assert.deepEqual(signed, { id: 'signed' });
  assert.deepEqual(calls, [['user-1', 'signed']]);
});

test('signal bundle runtime uploads the signed bundle payload without replenishing local keys first', async () => {
  const calls = [];
  await uploadSignedSignalBundle({
    authData: { userId: 'user-1', npub: 'npub-1' },
    deviceId: 7,
    getBundleFn: async () => ({ deviceId: 9, identityKey: 'bundle-key' }),
    getStableBundleFn: (bundle) => ({ identityKey: bundle.identityKey }),
    getLocalBundleAttestationFn: async () => ({ id: 'attestation' }),
    uploadPreKeyBundleFn: async (payload, deviceId) => calls.push(['upload', payload.bundleSignatureEvent.id, deviceId]),
  });

  assert.deepEqual(calls, [
    ['upload', 'attestation', 7],
  ]);
});
