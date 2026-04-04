import { useCallback, useMemo } from 'react';

import {
  checkNpubs,
  getContacts,
  getIncomingRequests,
  getSentRequests,
} from '../../api';
import { fetchProfile, searchProfiles } from '../../utils/nostr';
import { nip19 } from 'nostr-tools';

import {
  bindFollowingModalSocketRuntime,
  createFollowingModalLoadFriendsAction,
  createFollowingModalLoadRequestsAction,
  createFollowingModalLoadSentRequestsAction,
  startFollowingModalSearchRuntime,
} from './followingModalControllerRuntime.mjs';
import { useFollowingModalRuntimeEffects } from './useFollowingModalRuntimeEffects.mjs';

export function useFollowingModalControllerEffects({
  onClose,
  socket = null,
  state = {},
} = {}) {
  const {
    setContacts = () => {},
    setLoadingFriends = () => {},
    setProfiles = () => {},
    setIncoming = () => {},
    setLoadingRequests = () => {},
    setSentNpubs = () => {},
    searchTimerRef = { current: null },
    setSearchResults = () => {},
    setSearching = () => {},
    setGuildNpubs = () => {},
    selectedNpub = null,
    setSelectedNpub = () => {},
    query = '',
  } = state;

  const loadFriends = useMemo(() => createFollowingModalLoadFriendsAction({
    getContactsFn: getContacts,
    decodeNpubFn: nip19.decode,
    fetchProfileFn: fetchProfile,
    setContactsFn: setContacts,
    setLoadingFriendsFn: setLoadingFriends,
    setProfilesFn: setProfiles,
  }), [setContacts, setLoadingFriends, setProfiles]);

  const loadRequests = useMemo(() => createFollowingModalLoadRequestsAction({
    getIncomingRequestsFn: getIncomingRequests,
    setIncomingFn: setIncoming,
    setLoadingRequestsFn: setLoadingRequests,
  }), [setIncoming, setLoadingRequests]);

  const loadSentRequests = useMemo(() => createFollowingModalLoadSentRequestsAction({
    getSentRequestsFn: getSentRequests,
    setSentNpubsFn: setSentNpubs,
  }), [setSentNpubs]);

  const reloadContacts = useCallback(async () => {
    const nextContacts = await getContacts();
    setContacts(nextContacts);
  }, [setContacts]);

  const bindSocketRuntime = useCallback(({ socket: currentSocket }) => (
    bindFollowingModalSocketRuntime({
      socket: currentSocket,
      setIncomingFn: setIncoming,
      reloadContactsFn: reloadContacts,
    })
  ), [reloadContacts, setIncoming]);

  const startSearchRuntime = useCallback(({ query: currentQuery }) => (
    startFollowingModalSearchRuntime({
      query: currentQuery,
      timerRef: searchTimerRef,
      setSearchResultsFn: setSearchResults,
      setSearchingFn: setSearching,
      setGuildNpubsFn: setGuildNpubs,
      decodeNpubFn: nip19.decode,
      fetchProfileFn: fetchProfile,
      checkNpubsFn: checkNpubs,
      searchProfilesFn: searchProfiles,
    })
  ), [
    searchTimerRef,
    setGuildNpubs,
    setSearchResults,
    setSearching,
  ]);

  useFollowingModalRuntimeEffects({
    selectedNpub,
    clearSelectedNpub: () => setSelectedNpub(null),
    onClose,
    loadFriends,
    loadRequests,
    loadSentRequests,
    socket,
    bindSocketRuntime,
    query,
    startSearchRuntime,
  });
}
