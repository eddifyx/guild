import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reconcileSignalAttestedIdentity,
  validateSignalIdentityAttestation,
  verifyAndApproveSignalIdentity,
} from '../../../client/src/features/crypto/signalTrustRuntime.mjs';

test('signal trust runtime validates attestation signatures against the expected npub', async () => {
  const validated = await validateSignalIdentityAttestation({
    userId: 'user-2',
    identityRecord: {
      identityKey: 'remote-key',
      bundleSignatureEvent: { id: 'sig-1' },
    },
    resolveExpectedNpubFn: async () => 'npub-remote',
    getStableBundleFn: (record) => ({ identityKey: record.identityKey }),
    verifyBundleAttestationFn: () => true,
  });

  assert.equal(validated.expectedNpub, 'npub-remote');
  assert.equal(validated.stableBundle.identityKey, 'remote-key');
});

test('signal trust runtime rejects missing or invalid attestations', async () => {
  await assert.rejects(
    () => validateSignalIdentityAttestation({
      userId: 'user-2',
      identityRecord: { identityKey: 'remote-key' },
      resolveExpectedNpubFn: async () => 'npub-remote',
      getStableBundleFn: (record) => ({ identityKey: record.identityKey }),
      verifyBundleAttestationFn: () => true,
    }),
    /missing a Nostr attestation/,
  );

  await assert.rejects(
    () => validateSignalIdentityAttestation({
      userId: 'user-2',
      identityRecord: {
        identityKey: 'remote-key',
        bundleSignatureEvent: { id: 'sig-1' },
      },
      resolveExpectedNpubFn: async () => 'npub-remote',
      getStableBundleFn: (record) => ({ identityKey: record.identityKey }),
      verifyBundleAttestationFn: () => false,
    }),
    /attestation is invalid/,
  );
});

test('signal trust runtime reconciles rotated and untrusted identities through the canonical trust path', async () => {
  const calls = [];
  let state = { status: 'key_changed', verified: false };

  const trustState = await reconcileSignalAttestedIdentity({
    userId: 'user-2',
    deviceId: 3,
    identityKey: 'remote-key',
    getIdentityStateFn: async () => state,
    deleteSessionFn: async (userId, deviceId) => calls.push(['delete', userId, deviceId]),
    approveIdentityFn: async (userId, deviceId, identityKey, options) => {
      calls.push(['approve', userId, deviceId, identityKey, options.verified]);
      state = { status: 'trusted', verified: false };
    },
  });

  assert.deepEqual(calls, [
    ['delete', 'user-2', 3],
    ['approve', 'user-2', 3, 'remote-key', false],
  ]);
  assert.deepEqual(trustState, {
    status: 'trusted',
    verified: false,
    rotated: true,
  });
});

test('signal trust runtime returns a verified approved bundle payload', async () => {
  const result = await verifyAndApproveSignalIdentity({
    userId: 'user-2',
    deviceId: 4,
    identityRecord: { identityKey: 'remote-key' },
    validateIdentityAttestationFn: async () => ({
      stableBundle: { identityKey: 'remote-key', registrationId: 91 },
    }),
    reconcileAttestedIdentityFn: async () => ({
      status: 'trusted',
      verified: true,
      rotated: false,
    }),
  });

  assert.equal(result.deviceId, 4);
  assert.equal(result.identityKey, 'remote-key');
  assert.equal(result.verified, true);
  assert.equal(result.rotated, false);
});
