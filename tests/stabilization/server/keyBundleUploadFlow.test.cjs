const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isValidBase64Key,
  isValidBase64KeyRange,
  validateBundleUploadRequest,
} = require('../../../server/src/domain/keys/bundleUploadFlow');

function base64OfSize(size) {
  return Buffer.alloc(size, 7).toString('base64');
}

test('bundle upload flow validates fixed and ranged base64 key sizes', () => {
  assert.equal(isValidBase64Key(base64OfSize(32), 32), true);
  assert.equal(isValidBase64Key(base64OfSize(31), 32), false);
  assert.equal(isValidBase64KeyRange(base64OfSize(32), 32, 33), true);
  assert.equal(isValidBase64KeyRange(base64OfSize(33), 32, 33), true);
  assert.equal(isValidBase64KeyRange(base64OfSize(34), 32, 33), false);
});

test('bundle upload flow rejects expired legacy proof-of-possession payloads', async () => {
  const proofTimestamp = 1_000;
  const result = await validateBundleUploadRequest({
    userId: 'user-1',
    nowMs: proofTimestamp + (5 * 60 * 1000) + 1,
    body: {
      identityKey: base64OfSize(32),
      signingKey: base64OfSize(32),
      registrationId: 5,
      signedPreKey: {
        keyId: 1,
        publicKey: base64OfSize(32),
        signature: base64OfSize(64),
      },
      proof: base64OfSize(64),
      proofTimestamp,
    },
    verifyProofFn: () => true,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 403,
    error: 'Proof of possession expired',
  });
});

test('bundle upload flow rejects v2 bundle uploads without an attestation or Nostr identity', async () => {
  const basePayload = {
    identityKey: base64OfSize(33),
    registrationId: 9,
    signedPreKey: {
      keyId: 2,
      publicKey: base64OfSize(33),
      signature: base64OfSize(64),
    },
  };

  const missingAttestation = await validateBundleUploadRequest({
    userId: 'user-2',
    body: basePayload,
  });
  const missingNpub = await validateBundleUploadRequest({
    userId: 'user-2',
    body: {
      ...basePayload,
      bundleSignatureEvent: { kind: 24133 },
    },
  });

  assert.deepEqual(missingAttestation, {
    ok: false,
    status: 400,
    error: 'bundleSignatureEvent is required for v2 bundles',
  });
  assert.deepEqual(missingNpub, {
    ok: false,
    status: 403,
    error: 'User has no Nostr identity bound to this account',
  });
});

test('bundle upload flow returns canonical upload metadata for accepted legacy bundles', async () => {
  const body = {
    identityKey: base64OfSize(32),
    signingKey: base64OfSize(32),
    registrationId: 11,
    signedPreKey: {
      keyId: 3,
      publicKey: base64OfSize(32),
      signature: base64OfSize(64),
    },
    oneTimePreKeys: [{ keyId: 10, publicKey: base64OfSize(32) }],
    kyberPreKeys: [{ keyId: 12, publicKey: base64OfSize(33), signature: base64OfSize(64) }],
    proof: base64OfSize(64),
    proofTimestamp: 2_000,
  };

  const result = await validateBundleUploadRequest({
    userId: 'user-3',
    nowMs: 2_500,
    body,
    verifyProofFn: () => true,
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      isV2: false,
      storedSigningKey: body.signingKey,
      replaceServerPreKeys: true,
    },
  });
});

test('bundle upload flow validates v2 attestation signatures through the injected verifier', async () => {
  const body = {
    identityKey: base64OfSize(33),
    registrationId: 13,
    signedPreKey: {
      keyId: 4,
      publicKey: base64OfSize(33),
      signature: base64OfSize(64),
    },
    bundleSignatureEvent: { kind: 24133, id: 'attestation' },
  };

  const rejected = await validateBundleUploadRequest({
    userId: 'user-4',
    body,
    userNpub: 'npub-test',
    verifyBundleAttestationEventFn: () => false,
  });
  const accepted = await validateBundleUploadRequest({
    userId: 'user-4',
    body,
    userNpub: 'npub-test',
    verifyBundleAttestationEventFn: () => true,
  });

  assert.deepEqual(rejected, {
    ok: false,
    status: 403,
    error: 'Invalid bundle attestation signature',
  });
  assert.deepEqual(accepted, {
    ok: true,
    value: {
      isV2: true,
      storedSigningKey: body.identityKey,
      replaceServerPreKeys: false,
    },
  });
});
