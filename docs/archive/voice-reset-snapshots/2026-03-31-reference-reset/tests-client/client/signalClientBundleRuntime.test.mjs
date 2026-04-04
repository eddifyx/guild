import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientBundleRuntime } from '../../../client/src/features/crypto/signalClientBundleRuntime.mjs';

test('signal client bundle runtime resolves and uploads the canonical signed bundle contract', async () => {
  const calls = [];
  const runtime = createSignalClientBundleRuntime({
    getCurrentDeviceIdFn: () => 7,
    getBundleFn: async () => ({ bundle: 'raw' }),
    getStableBundleFn: (bundle) => ({ stable: bundle.bundle }),
    loadCachedBundleAttestationFn: async () => null,
    signBundleAttestationFn: async () => ({ sig: 'signed' }),
    storeBundleAttestationFn: async () => {},
    uploadPreKeyBundleFn: async () => {},
    otpCountFn: async () => 8,
    replenishOTPsFn: async () => {},
    kyberCountFn: async () => 5,
    replenishKyberFn: async () => {},
    loadOrCreateSignalBundleAttestationFn: async () => ({ sig: 'signed' }),
    uploadSignedSignalBundleFn: async (options) => {
      calls.push(options);
      return { ok: true };
    },
  });

  const stableBundle = await runtime.getStableLocalBundle();
  const attestation = await runtime.getLocalBundleAttestation({ userId: 'user-1', npub: 'npub1' }, stableBundle);
  const uploadResult = await runtime.uploadSignedBundle(
    { userId: 'user-1', npub: 'npub1' },
    { deviceId: 19, forceFreshAttestation: true },
  );

  assert.deepEqual(stableBundle, { stable: 'raw' });
  assert.deepEqual(attestation, { sig: 'signed' });
  assert.deepEqual(uploadResult, { ok: true });
  assert.equal(calls[0].deviceId, 19);
  assert.equal(calls[0].forceFreshAttestation, true);
  assert.equal(typeof calls[0].getLocalBundleAttestationFn, 'function');
});
