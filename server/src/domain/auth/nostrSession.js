const LOGIN_COMPAT_KIND = 1;
const LOGIN_COMPAT_CONTENT = '/guild login';
const LOGIN_COMPAT_CLIENT = '/guild';
const LOGIN_PROOF_EVENT_MAX_SKEW_SECONDS = 300;

function sanitizeProfilePictureUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2048);
  return null;
}

function isAcceptedLoginProofEvent(event) {
  if (!event || typeof event !== 'object') return false;

  if (event.kind === 22242) {
    return event.content === '' || event.content === LOGIN_COMPAT_CONTENT;
  }

  if (event.kind === LOGIN_COMPAT_KIND) {
    const clientTag = event.tags.find((tag) => Array.isArray(tag) && tag[0] === 'client');
    return clientTag?.[1] === LOGIN_COMPAT_CLIENT && event.content === LOGIN_COMPAT_CONTENT;
  }

  return false;
}

function validateLoginChallenge({ storedChallenge, now = Date.now() } = {}) {
  if (!storedChallenge) {
    return { ok: false, status: 401, error: 'Unknown or expired challenge' };
  }

  if (now >= storedChallenge.expiresAt) {
    return { ok: false, status: 401, error: 'Challenge expired' };
  }

  return { ok: true };
}

function validateLoginProofTimestamp(event, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!event || typeof event.created_at !== 'number') {
    return { ok: false, status: 401, error: 'Event timestamp too far from current time' };
  }

  if (Math.abs(nowSeconds - event.created_at) > LOGIN_PROOF_EVENT_MAX_SKEW_SECONDS) {
    return { ok: false, status: 401, error: 'Event timestamp too far from current time' };
  }

  return { ok: true };
}

function buildNewUserRecord({ id, npub, displayName, lud16, profilePicture, hashColor }) {
  const trimmedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const trimmedLud16 = typeof lud16 === 'string' ? lud16.trim() : '';
  const sanitizedPicture = sanitizeProfilePictureUrl(profilePicture);

  return {
    id,
    username: trimmedDisplayName
      ? trimmedDisplayName.slice(0, 30)
      : `${npub.slice(0, 8)}...${npub.slice(-4)}`,
    avatarColor: hashColor(npub),
    npub,
    lud16: trimmedLud16 || null,
    profilePicture: sanitizedPicture,
  };
}

function resolveExistingUserProfileUpdates({ user, lud16, profilePicture }) {
  const nextLud16 = typeof lud16 === 'string' ? lud16.trim() : '';
  const nextProfilePicture = sanitizeProfilePictureUrl(profilePicture);
  const updates = {};

  if (nextLud16 && nextLud16 !== user?.lud16) {
    updates.lud16 = nextLud16;
  }

  if (nextProfilePicture && nextProfilePicture !== user?.profile_picture) {
    updates.profilePicture = nextProfilePicture;
  }

  return updates;
}

function buildAuthResponsePayload({ user, token }) {
  return {
    userId: user.id,
    username: user.username,
    avatarColor: user.avatar_color,
    npub: user.npub,
    lud16: user.lud16 || null,
    profilePicture: user.profile_picture || null,
    token,
  };
}

module.exports = {
  LOGIN_COMPAT_CLIENT,
  LOGIN_COMPAT_CONTENT,
  LOGIN_COMPAT_KIND,
  LOGIN_PROOF_EVENT_MAX_SKEW_SECONDS,
  buildAuthResponsePayload,
  buildNewUserRecord,
  isAcceptedLoginProofEvent,
  resolveExistingUserProfileUpdates,
  sanitizeProfilePictureUrl,
  validateLoginChallenge,
  validateLoginProofTimestamp,
};
