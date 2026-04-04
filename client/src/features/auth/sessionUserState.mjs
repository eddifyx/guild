export function normalizeSessionUser(authData) {
  if (!authData || typeof authData !== 'object') return null;
  if (typeof authData.token !== 'string' || typeof authData.userId !== 'string') return null;

  return {
    userId: authData.userId,
    username: typeof authData.username === 'string' ? authData.username : '',
    avatarColor: typeof authData.avatarColor === 'string' ? authData.avatarColor : null,
    npub: typeof authData.npub === 'string' ? authData.npub : null,
    profilePicture: typeof authData.profilePicture === 'string' ? authData.profilePicture : null,
    token: authData.token,
  };
}

export function buildAuthenticatedSessionUser(responseData) {
  return normalizeSessionUser({
    userId: responseData?.userId,
    username: responseData?.username,
    avatarColor: responseData?.avatarColor,
    npub: responseData?.npub,
    profilePicture: responseData?.profilePicture ?? null,
    token: responseData?.token,
  });
}

export function mergeSessionUser(currentUser, updates) {
  if (!currentUser) return currentUser;

  const patch = typeof updates === 'function' ? updates(currentUser) : updates;
  if (!patch || typeof patch !== 'object') return currentUser;

  return normalizeSessionUser({
    ...currentUser,
    ...patch,
  }) || currentUser;
}

export function buildSyncedSessionPatch({ currentUser, syncedUser }) {
  if (!currentUser || !syncedUser) return null;

  return {
    username: syncedUser.username,
    avatarColor: syncedUser.avatarColor,
    npub: syncedUser.npub || currentUser.npub || null,
    profilePicture: syncedUser.profilePicture || null,
  };
}

export function buildCreatedAccountSessionUser({ authData, syncedUser, nextProfilePicture = null }) {
  return mergeSessionUser(authData, {
    username: syncedUser?.username,
    avatarColor: syncedUser?.avatarColor,
    npub: syncedUser?.npub || authData?.npub || null,
    profilePicture: syncedUser?.profilePicture || nextProfilePicture || null,
  });
}
