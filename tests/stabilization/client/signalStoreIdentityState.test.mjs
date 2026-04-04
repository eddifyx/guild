import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  buildApprovedIdentityState,
  buildIdentityTrustState,
  buildSavedIdentityState,
  isTrustedIdentityRecord,
} = require('../../../client/electron/crypto/signalStoreIdentityState.js');

test('signal store identity state builds trust status for new, changed, and trusted identities canonically', () => {
  const existing = {
    keyBytes: Buffer.from('key-a', 'utf8'),
    trusted: true,
    verified: true,
    firstSeen: 10,
    lastSeen: 20,
  };

  assert.deepEqual(buildIdentityTrustState(null), {
    status: 'new',
    trusted: false,
    verified: false,
    firstSeen: null,
    lastSeen: null,
    identityKey: null,
  });

  assert.deepEqual(buildIdentityTrustState(existing, Buffer.from('key-b', 'utf8')), {
    status: 'key_changed',
    trusted: false,
    verified: false,
    firstSeen: 10,
    lastSeen: 20,
    identityKey: Buffer.from('key-a', 'utf8').toString('base64'),
  });

  assert.deepEqual(buildIdentityTrustState(existing, Buffer.from('key-a', 'utf8')), {
    status: 'trusted',
    trusted: true,
    verified: true,
    firstSeen: 10,
    lastSeen: 20,
    identityKey: Buffer.from('key-a', 'utf8').toString('base64'),
  });
});

test('signal store identity state builds approval transitions with verification reset only on key changes', () => {
  const existing = {
    keyBytes: Buffer.from('key-a', 'utf8'),
    trusted: false,
    verified: true,
    firstSeen: 10,
    lastSeen: 20,
  };

  assert.deepEqual(
    buildApprovedIdentityState(existing, Buffer.from('key-a', 'utf8'), {}, 50),
    {
      changed: false,
      verified: true,
      record: {
        trusted: true,
        verified: true,
        firstSeen: 10,
        lastSeen: 50,
      },
    }
  );

  assert.deepEqual(
    buildApprovedIdentityState(existing, Buffer.from('key-b', 'utf8'), {}, 60),
    {
      changed: true,
      verified: false,
      record: {
        trusted: true,
        verified: false,
        firstSeen: 10,
        lastSeen: 60,
      },
    }
  );

  assert.deepEqual(
    buildApprovedIdentityState(existing, Buffer.from('key-b', 'utf8'), { verified: true }, 70),
    {
      changed: true,
      verified: true,
      record: {
        trusted: true,
        verified: true,
        firstSeen: 10,
        lastSeen: 70,
      },
    }
  );
});

test('signal store identity state builds save transitions and trusted checks canonically', () => {
  const IdentityChange = {
    NewOrUnchanged: 'new-or-unchanged',
    ReplacedExisting: 'replaced-existing',
  };
  const existing = {
    keyBytes: Buffer.from('key-a', 'utf8'),
    trusted: true,
    verified: true,
    firstSeen: 10,
    lastSeen: 20,
  };

  assert.deepEqual(
    buildSavedIdentityState(null, Buffer.from('key-a', 'utf8'), IdentityChange, 50),
    {
      change: 'new-or-unchanged',
      record: {
        trusted: false,
        verified: false,
        firstSeen: 50,
        lastSeen: 50,
      },
    }
  );

  assert.deepEqual(
    buildSavedIdentityState(existing, Buffer.from('key-b', 'utf8'), IdentityChange, 60),
    {
      change: 'replaced-existing',
      record: {
        trusted: false,
        verified: false,
        firstSeen: 10,
        lastSeen: 60,
      },
    }
  );

  assert.deepEqual(
    buildSavedIdentityState(existing, Buffer.from('key-a', 'utf8'), IdentityChange, 70),
    {
      change: 'new-or-unchanged',
      record: {
        trusted: true,
        verified: true,
        firstSeen: 10,
        lastSeen: 70,
      },
    }
  );

  assert.equal(isTrustedIdentityRecord(existing, Buffer.from('key-a', 'utf8')), true);
  assert.equal(isTrustedIdentityRecord(existing, Buffer.from('key-b', 'utf8')), false);
  assert.equal(
    isTrustedIdentityRecord({ ...existing, trusted: false }, Buffer.from('key-a', 'utf8')),
    false
  );
});
