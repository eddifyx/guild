export const FOLLOWING_MODAL_INVITE_TEXT = `/guild — Nostr-native, end-to-end encrypted, and fully open source. Voice, chat rooms, streaming, and more — all built on your Nostr keys. No accounts, no middlemen. Download at https://guild.app`;

export function getFollowingModalSearchPlan(query = '') {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return { mode: 'idle', query: trimmedQuery, delayMs: 0 };
  }
  if (trimmedQuery.startsWith('npub1')) {
    return { mode: 'npub', query: trimmedQuery, delayMs: 200 };
  }
  return { mode: 'profiles', query: trimmedQuery, delayMs: 400 };
}

export function mergeFollowingModalIncomingRequests(previous = [], nextRequest = null) {
  if (!nextRequest?.id) {
    return previous;
  }
  return [nextRequest, ...previous.filter((request) => request.id !== nextRequest.id)];
}

export function applyFollowingModalProfile(previousProfiles = {}, npub = '', profile = null) {
  if (!npub || !profile) {
    return previousProfiles;
  }
  return {
    ...previousProfiles,
    [npub]: profile,
  };
}

export function toggleFollowingModalInviteMenu(currentNpub = null, nextNpub = null) {
  return currentNpub === nextNpub ? null : nextNpub;
}
