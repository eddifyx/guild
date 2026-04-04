export function formatFollowingModalNpub(npub = '', prefixLength = 20, suffixLength = 6) {
  if (!npub) {
    return '';
  }
  if (npub.length <= prefixLength + suffixLength + 3) {
    return npub;
  }
  return `${npub.slice(0, prefixLength)}...${npub.slice(-suffixLength)}`;
}

export function buildFollowingModalTabs({
  activeTab = 'friends',
  contactsCount = 0,
  incomingCount = 0,
} = {}) {
  return [
    { key: 'friends', label: 'Friends', count: contactsCount, active: activeTab === 'friends' },
    { key: 'requests', label: 'Requests', count: incomingCount, active: activeTab === 'requests' },
    { key: 'search', label: 'Search', count: 0, active: activeTab === 'search' },
  ];
}

export function getFollowingModalSearchMessageTone(message = '') {
  if (!message) {
    return 'neutral';
  }
  return message.includes('!') ? 'success' : 'error';
}

export function buildFollowingModalSearchViewState({
  query = '',
  searching = false,
  searchResults = [],
} = {}) {
  const trimmedQuery = query.trim();
  if (searching) {
    return { mode: 'searching', message: 'Searching...' };
  }
  if (trimmedQuery.length >= 2 && searchResults.length === 0) {
    return { mode: 'empty', message: 'No users found' };
  }
  if (searchResults.length > 0) {
    return { mode: 'results', message: '' };
  }
  return {
    mode: 'prompt',
    message: 'Search for Nostr users by name or paste an npub',
  };
}

export function getFollowingModalResultActionState({
  npub = '',
  friendNpubs = new Set(),
  sentNpubs = new Set(),
  guildNpubs = new Set(),
  sendingNpub = null,
  sendingDM = false,
  inviteMenuNpub = null,
} = {}) {
  if (friendNpubs.has(npub)) {
    return { kind: 'friends' };
  }
  if (sentNpubs.has(npub)) {
    return { kind: 'pending' };
  }
  if (guildNpubs.has(npub)) {
    return {
      kind: 'request',
      busy: sendingNpub === npub,
    };
  }
  return {
    kind: 'invite',
    busy: Boolean(sendingDM),
    open: inviteMenuNpub === npub,
  };
}

export function buildFollowingModalSearchResultRow(result = {}) {
  const npub = result?.npub || '';
  return {
    ...result,
    npub,
    displayName: result?.name || formatFollowingModalNpub(npub, 16, 0),
    npubLabel: formatFollowingModalNpub(npub, 20, 6),
  };
}

export function buildFollowingModalIncomingRequestRow(request = {}) {
  const npub = request?.from_npub || '';
  return {
    ...request,
    npub,
    displayName: request?.from_username || 'Unknown',
    avatarName: request?.from_username || formatFollowingModalNpub(npub, 8, 0) || '?',
    npubLabel: npub ? formatFollowingModalNpub(npub, 20, 6) : '',
  };
}

export function buildFollowingModalFriendRow({
  contact = {},
  profile = null,
  selectedNpub = null,
} = {}) {
  const npub = contact?.contact_npub || '';
  const name = profile?.name || contact?.display_name || null;
  return {
    contact,
    npub,
    name,
    picture: profile?.picture || null,
    displayName: name || formatFollowingModalNpub(npub, 16, 0),
    rowNpubLabel: formatFollowingModalNpub(npub, 20, 6),
    cardNpubLabel: formatFollowingModalNpub(npub, 24, 6),
    selected: selectedNpub === npub,
  };
}
