function buildIdentityTrustState(existing, candidateBytes = null) {
  if (!existing) {
    return {
      status: 'new',
      trusted: false,
      verified: false,
      firstSeen: null,
      lastSeen: null,
      identityKey: null,
    };
  }

  if (candidateBytes && !candidateBytes.equals(existing.keyBytes)) {
    return {
      status: 'key_changed',
      trusted: false,
      verified: false,
      firstSeen: existing.firstSeen,
      lastSeen: existing.lastSeen,
      identityKey: existing.keyBytes.toString('base64'),
    };
  }

  return {
    status: existing.trusted ? 'trusted' : 'new',
    trusted: existing.trusted,
    verified: existing.verified,
    firstSeen: existing.firstSeen,
    lastSeen: existing.lastSeen,
    identityKey: existing.keyBytes.toString('base64'),
  };
}

function buildApprovedIdentityState(existing, keyBytes, options = {}, now = Date.now()) {
  const changed = existing ? !keyBytes.equals(existing.keyBytes) : false;
  const verified = options.verified === true ? true : (changed ? false : !!existing?.verified);

  return {
    changed,
    verified,
    record: {
      trusted: true,
      verified,
      firstSeen: existing?.firstSeen ?? now,
      lastSeen: now,
    },
  };
}

function buildSavedIdentityState(existing, keyBytes, IdentityChange, now = Date.now()) {
  if (!existing) {
    return {
      change: IdentityChange.NewOrUnchanged,
      record: {
        trusted: false,
        verified: false,
        firstSeen: now,
        lastSeen: now,
      },
    };
  }

  const changed = !keyBytes.equals(existing.keyBytes);
  if (changed) {
    return {
      change: IdentityChange.ReplacedExisting,
      record: {
        trusted: false,
        verified: false,
        firstSeen: existing.firstSeen ?? now,
        lastSeen: now,
      },
    };
  }

  return {
    change: IdentityChange.NewOrUnchanged,
    record: {
      trusted: existing.trusted,
      verified: existing.verified,
      firstSeen: existing.firstSeen ?? now,
      lastSeen: now,
    },
  };
}

function isTrustedIdentityRecord(existing, keyBytes) {
  if (!existing || !existing.trusted) return false;
  return keyBytes.equals(existing.keyBytes);
}

module.exports = {
  buildApprovedIdentityState,
  buildIdentityTrustState,
  buildSavedIdentityState,
  isTrustedIdentityRecord,
};
