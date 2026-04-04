import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveSignalBundleAttestationSignerSession,
} from '../../../client/src/features/crypto/signalBundleAttestationSessionRuntime.mjs';

test('signal bundle attestation session runtime restores signer state on demand', async () => {
  let signer = null;
  let pubkey = null;
  let reconnectCalls = 0;

  const result = await resolveSignalBundleAttestationSignerSession({
    getSignerFn: () => signer,
    getUserPubkeyFn: () => pubkey,
    reconnectSignerFn: async () => {
      reconnectCalls += 1;
      signer = { signEvent: async (event) => event };
      pubkey = 'pubkey-1';
      return true;
    },
  });

  assert.equal(reconnectCalls, 1);
  assert.equal(result.restored, true);
  assert.equal(result.signer, signer);
  assert.equal(result.pubkey, 'pubkey-1');
});

test('signal bundle attestation session runtime returns missing signer state when restore fails', async () => {
  const result = await resolveSignalBundleAttestationSignerSession({
    getSignerFn: () => null,
    getUserPubkeyFn: () => null,
    reconnectSignerFn: async () => false,
  });

  assert.equal(result.signer, null);
  assert.equal(result.pubkey, null);
  assert.equal(result.restored, false);
});
