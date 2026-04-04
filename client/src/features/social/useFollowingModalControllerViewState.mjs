import { useMemo } from 'react';

import {
  buildFollowingModalFriendRow,
  buildFollowingModalIncomingRequestRow,
  buildFollowingModalSearchResultRow,
  buildFollowingModalSearchViewState,
  buildFollowingModalTabs,
  getFollowingModalSearchMessageTone,
} from './followingModalModel.mjs';

export function useFollowingModalControllerViewState({
  tab = 'friends',
  contacts = [],
  profiles = {},
  selectedNpub = null,
  incoming = [],
  query = '',
  searching = false,
  searchResults = [],
  searchMsg = '',
} = {}) {
  const friendNpubs = useMemo(
    () => new Set(contacts.map((contact) => contact.contact_npub)),
    [contacts],
  );

  const tabs = useMemo(() => buildFollowingModalTabs({
    activeTab: tab,
    contactsCount: contacts.length,
    incomingCount: incoming.length,
  }), [contacts.length, incoming.length, tab]);

  const searchViewState = useMemo(() => buildFollowingModalSearchViewState({
    query,
    searching,
    searchResults,
  }), [query, searchResults, searching]);

  const searchMessageTone = useMemo(
    () => getFollowingModalSearchMessageTone(searchMsg),
    [searchMsg],
  );

  const friendRows = useMemo(
    () => contacts.map((contact) => buildFollowingModalFriendRow({
      contact,
      profile: profiles[contact.contact_npub] || null,
      selectedNpub,
    })),
    [contacts, profiles, selectedNpub],
  );

  const incomingRows = useMemo(
    () => incoming.map((request) => buildFollowingModalIncomingRequestRow(request)),
    [incoming],
  );

  const searchRows = useMemo(
    () => searchResults.map((result) => buildFollowingModalSearchResultRow(result)),
    [searchResults],
  );

  return {
    friendNpubs,
    tabs,
    searchViewState,
    searchMessageTone,
    friendRows,
    incomingRows,
    searchRows,
  };
}
