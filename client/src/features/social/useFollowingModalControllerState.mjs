import { useRef, useState } from 'react';

export function useFollowingModalControllerState() {
  const [tab, setTab] = useState('friends');
  const [contacts, setContacts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedNpub, setSelectedNpub] = useState(null);
  const [copied, setCopied] = useState(false);

  const [incoming, setIncoming] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [actioningId, setActioningId] = useState(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [guildNpubs, setGuildNpubs] = useState(new Set());
  const [sentNpubs, setSentNpubs] = useState(new Set());
  const [sendingNpub, setSendingNpub] = useState(null);
  const [searchMsg, setSearchMsg] = useState('');
  const [inviteMenuNpub, setInviteMenuNpub] = useState(null);
  const [sendingDM, setSendingDM] = useState(false);

  const searchTimerRef = useRef(null);

  return {
    tab,
    setTab,
    contacts,
    setContacts,
    profiles,
    setProfiles,
    loadingFriends,
    setLoadingFriends,
    selectedNpub,
    setSelectedNpub,
    copied,
    setCopied,
    incoming,
    setIncoming,
    loadingRequests,
    setLoadingRequests,
    actioningId,
    setActioningId,
    query,
    setQuery,
    searchResults,
    setSearchResults,
    searching,
    setSearching,
    guildNpubs,
    setGuildNpubs,
    sentNpubs,
    setSentNpubs,
    sendingNpub,
    setSendingNpub,
    searchMsg,
    setSearchMsg,
    inviteMenuNpub,
    setInviteMenuNpub,
    sendingDM,
    setSendingDM,
    searchTimerRef,
  };
}
