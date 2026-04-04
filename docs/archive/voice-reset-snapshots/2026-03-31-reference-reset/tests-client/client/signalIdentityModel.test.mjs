import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDirectMessageEnvelopePayload,
  buildDirectMessageTargets,
  buildLocalRegistrationResult,
  getAddressKey,
  getNormalizedIdentityDeviceIds,
  getStableBundle,
  hasConflictingDeviceRegistration,
  isDeferredBundleAttestationError,
  normalizeIdentityRecords,
  selectIdentityRecord,
} from '../../../client/src/features/crypto/signalIdentityModel.mjs';

test('signal identity model matches deferred bundle attestation startup failures', () => {
  assert.equal(
    isDeferredBundleAttestationError(new Error('Timed out waiting for Signal bundle attestation signature')),
    true,
  );
  assert.equal(
    isDeferredBundleAttestationError(new Error('Nostr signer unavailable for Signal identity attestation')),
    true,
  );
  assert.equal(
    isDeferredBundleAttestationError(new Error('Some unrelated startup error')),
    false,
  );
});

test('signal identity model normalizes identity rows and device selection consistently', () => {
  const identities = normalizeIdentityRecords([
    { userId: 'user-1', identityKey: 'ik-1', deviceId: '7' },
    { userId: 'user-1', identityKey: 'ik-2' },
  ]);

  assert.deepEqual(identities.map((identity) => identity.deviceId), [7, 1]);
  assert.deepEqual(getNormalizedIdentityDeviceIds(identities), [7, 1]);
  assert.equal(selectIdentityRecord(identities, 7)?.identityKey, 'ik-1');
  assert.equal(selectIdentityRecord(identities, 999)?.identityKey, 'ik-1');
});

test('signal identity model derives stable local registration and conflict state', () => {
  const localBundle = getStableBundle({
    identityKey: 'local-key',
    registrationId: 55,
    signedPreKey: 'signed-local',
    ignored: 'value',
  });

  assert.deepEqual(localBundle, {
    identityKey: 'local-key',
    registrationId: 55,
    signedPreKey: 'signed-local',
  });

  assert.deepEqual(
    buildLocalRegistrationResult(3, localBundle, { canUploadBundle: false }).deviceId,
    3,
  );

  assert.equal(
    hasConflictingDeviceRegistration([
      { deviceId: 3, identityKey: 'remote-key' },
      { deviceId: 4, identityKey: 'other-key' },
    ], 3, localBundle),
    true,
  );
  assert.equal(
    hasConflictingDeviceRegistration([{ deviceId: 3, identityKey: 'local-key' }], 3, localBundle),
    false,
  );
});

test('signal identity model builds deduped DM targets and stable legacy envelope payloads', () => {
  const targets = buildDirectMessageTargets({
    recipientId: 'user-2',
    recipientDevices: [
      { deviceId: 1, identityKey: 'remote-1' },
      { deviceId: '1', identityKey: 'remote-1-duplicate' },
      { deviceId: 2, identityKey: 'remote-2' },
    ],
    selfDevices: [
      { deviceId: 3, identityKey: 'self-3' },
      { deviceId: 3, identityKey: 'self-3-duplicate' },
    ],
    currentUserId: 'user-1',
  });

  assert.deepEqual(
    targets.map((target) => getAddressKey(target.userId, target.deviceId)),
    ['user-2:1', 'user-2:2', 'user-1:3'],
  );

  const legacyEnvelope = buildDirectMessageEnvelopePayload({
    recipientId: 'user-2',
    senderDeviceId: 1,
    copies: [
      { recipientUserId: 'user-2', recipientDeviceId: 1, type: 3, payload: 'cipher-1' },
      { recipientUserId: 'user-2', recipientDeviceId: 2, type: 3, payload: 'cipher-2' },
      { recipientUserId: 'user-1', recipientDeviceId: 3, type: 3, payload: 'cipher-self' },
    ],
  });

  assert.equal(legacyEnvelope.v, 2);
  assert.equal(legacyEnvelope.type, 3);
  assert.equal(legacyEnvelope.payload, 'cipher-1');

  const multiDeviceEnvelope = buildDirectMessageEnvelopePayload({
    recipientId: 'user-2',
    senderDeviceId: 4,
    copies: [
      { recipientUserId: 'user-2', recipientDeviceId: 2, type: 3, payload: 'cipher-2' },
    ],
  });

  assert.equal(multiDeviceEnvelope.v, 3);
  assert.equal(multiDeviceEnvelope.type, undefined);
  assert.throws(
    () => buildDirectMessageEnvelopePayload({ recipientId: 'user-2', senderDeviceId: 1, copies: [] }),
    /No trusted devices/,
  );
});
