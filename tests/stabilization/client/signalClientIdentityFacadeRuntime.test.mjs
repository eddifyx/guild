import test from 'node:test';
import assert from 'node:assert/strict';

import { createSignalClientIdentityFacadeRuntime } from '../../../client/src/features/crypto/signalClientIdentityFacadeRuntime.mjs';

test('signal client identity facade runtime delegates identity and session passthrough operations', async () => {
  const calls = [];
  const runtime = createSignalClientIdentityFacadeRuntime({
    signalCrypto: {
      hasSession: async (...args) => {
        calls.push(['has-session', ...args]);
        return true;
      },
      deleteSession: async (...args) => {
        calls.push(['delete-session', ...args]);
        return 'deleted';
      },
      getIdentityState: async (...args) => {
        calls.push(['get-identity-state', ...args]);
        return 'trusted';
      },
      approveIdentity: async (...args) => {
        calls.push(['approve-identity', ...args]);
        return 'approved';
      },
      markIdentityVerified: async (...args) => {
        calls.push(['mark-identity-verified', ...args]);
        return 'verified';
      },
      getFingerprint: async (...args) => {
        calls.push(['get-fingerprint', ...args]);
        return 'fingerprint';
      },
    },
    loadRemoteIdentityVerificationStateFn: async (options) => {
      calls.push(['load-remote-verification', options.recipientId]);
      return { ok: true };
    },
    fetchDeviceIdentityRecordsCachedFn: async () => [{ deviceId: 1 }],
    validateIdentityAttestationFn: async () => true,
    reconcileAttestedIdentityFn: async () => true,
  });

  assert.equal(await runtime.hasSession('peer-1', 2), true);
  assert.equal(await runtime.deleteSession('peer-1', 2), 'deleted');
  assert.equal(await runtime.getIdentityStatus('peer-1', 2, 'ik-1'), 'trusted');
  assert.deepEqual(await runtime.loadRemoteIdentityVerification('peer-1'), { ok: true });
  assert.equal(await runtime.approveIdentity('peer-1', 'ik-1', { trusted: true }, 2), 'approved');
  assert.equal(await runtime.markIdentityVerified('peer-1', 'ik-1', 2), 'verified');
  assert.equal(await runtime.getFingerprint('peer-1', 'ik-1'), 'fingerprint');

  assert.deepEqual(calls, [
    ['has-session', 'peer-1', 2],
    ['delete-session', 'peer-1', 2],
    ['get-identity-state', 'peer-1', 2, 'ik-1'],
    ['load-remote-verification', 'peer-1'],
    ['approve-identity', 'peer-1', 2, 'ik-1', { trusted: true }],
    ['mark-identity-verified', 'peer-1', 2, 'ik-1'],
    ['get-fingerprint', 'peer-1', 'ik-1'],
  ]);
});
