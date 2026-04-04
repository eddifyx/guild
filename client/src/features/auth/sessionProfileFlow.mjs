import { nip19 } from 'nostr-tools';

import {
  buildCreatedAccountSessionUser,
  buildSyncedSessionPatch,
} from './sessionUserState.mjs';

export function resolveSessionPubkey(npub) {
  if (typeof npub !== 'string' || !npub.trim()) return null;
  try {
    return nip19.decode(npub).data;
  } catch {
    return null;
  }
}

export function trimProfileDraft(profile) {
  if (!profile || typeof profile !== 'object') return null;

  return {
    name: (profile.name || '').trim().slice(0, 50),
    about: (profile.about || '').trim().slice(0, 250),
    picture: (profile.picture || '').trim(),
    banner: (profile.banner || '').trim(),
    lud16: (profile.lud16 || '').trim(),
  };
}

export function shouldPublishProfileDraft(profile, profileImageFile = null) {
  return Boolean(
    profile && (
      profile.name ||
      profile.about ||
      profile.picture ||
      profile.banner ||
      profile.lud16 ||
      profileImageFile
    )
  );
}

export function validateProfileDraft(profile) {
  if (profile?.picture && !/^https?:\/\//i.test(profile.picture)) {
    throw new Error('Profile picture must be an http(s) URL');
  }
}

export async function syncSessionNostrProfile({
  user,
  profileOverride = null,
  loadProfile,
  apiRequest,
}) {
  if (!user?.npub || !user?.token) return null;

  const pubkey = resolveSessionPubkey(user.npub);
  if (!pubkey) return null;

  const relayProfile = profileOverride || await loadProfile(pubkey);
  if (!relayProfile) return null;

  const desiredName = (relayProfile.name || '').trim() || user.username;
  const desiredPicture = (relayProfile.picture || '').trim() || null;
  const desiredLud16 = (relayProfile.lud16 || '').trim() || null;

  const syncedUser = await apiRequest('/api/users/me/nostr-profile', {
    method: 'PUT',
    body: JSON.stringify({
      displayName: desiredName,
      profilePicture: desiredPicture,
      lud16: desiredLud16,
    }),
  });

  return {
    profile: relayProfile,
    syncedUser,
    syncedPatch: buildSyncedSessionPatch({
      currentUser: user,
      syncedUser,
    }),
  };
}

export async function finalizeCreatedAccountProfile({
  authData,
  profile = null,
  profileImageFile = null,
  uploadImage,
  publishProfile,
  apiRequest,
  persistAuth,
}) {
  const trimmedProfile = trimProfileDraft(profile);
  if (!shouldPublishProfileDraft(trimmedProfile, profileImageFile)) {
    return { authData, profile: null };
  }

  validateProfileDraft(trimmedProfile);

  let pictureUrl = trimmedProfile.picture || '';
  if (profileImageFile) {
    pictureUrl = await uploadImage(profileImageFile);
  }

  const nextProfile = {
    ...trimmedProfile,
    picture: pictureUrl,
  };

  const publishResult = await publishProfile(nextProfile);
  if (!publishResult.ok) {
    throw new Error(publishResult.error || 'Failed to publish Nostr profile');
  }

  const syncedUser = await apiRequest('/api/users/me/nostr-profile', {
    method: 'PUT',
    body: JSON.stringify({
      displayName: nextProfile.name || authData.username,
      profilePicture: nextProfile.picture || null,
      lud16: nextProfile.lud16 || null,
    }),
  });

  const nextAuthData = buildCreatedAccountSessionUser({
    authData,
    syncedUser,
    nextProfilePicture: nextProfile.picture || null,
  });

  if (typeof persistAuth === 'function') {
    persistAuth(nextAuthData);
  }

  return {
    authData: nextAuthData,
    profile: nextProfile,
  };
}
