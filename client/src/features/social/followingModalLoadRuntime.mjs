import { applyFollowingModalProfile } from './followingModalRuntime.mjs';

export function createFollowingModalLoadFriendsAction({
  getContactsFn,
  decodeNpubFn,
  fetchProfileFn,
  setContactsFn,
  setLoadingFriendsFn,
  setProfilesFn,
  applyProfileFn = applyFollowingModalProfile,
}) {
  return async ({ isCancelled = () => false } = {}) => {
    try {
      const nextContacts = await getContactsFn();
      if (isCancelled()) {
        return;
      }
      setContactsFn(nextContacts);
      setLoadingFriendsFn(false);
      for (const contact of nextContacts) {
        try {
          const decoded = decodeNpubFn(contact.contact_npub);
          const profile = await fetchProfileFn(decoded.data);
          if (isCancelled()) {
            return;
          }
          if (!profile) {
            continue;
          }
          setProfilesFn((previous) => applyProfileFn(previous, contact.contact_npub, profile));
        } catch {
          // ignore per-contact profile failures
        }
      }
    } catch {
      if (!isCancelled()) {
        setLoadingFriendsFn(false);
      }
    }
  };
}

export function createFollowingModalLoadRequestsAction({
  getIncomingRequestsFn,
  setIncomingFn,
  setLoadingRequestsFn,
}) {
  return async () => {
    try {
      const nextIncoming = await getIncomingRequestsFn();
      setIncomingFn(nextIncoming);
    } catch {
      // ignore request load failures
    }
    setLoadingRequestsFn(false);
  };
}

export function createFollowingModalLoadSentRequestsAction({
  getSentRequestsFn,
  setSentNpubsFn,
}) {
  return async () => {
    try {
      const list = await getSentRequestsFn();
      setSentNpubsFn(new Set(list.map((request) => request.to_npub)));
    } catch {
      // ignore sent request load failures
    }
  };
}
