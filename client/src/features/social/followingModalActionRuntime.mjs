export function createFollowingModalSendRequestAction({
  sendFriendRequestFn = async () => {},
  setSendingNpubFn = () => {},
  setSearchMsgFn = () => {},
  setSentNpubsFn = () => {},
  clearSearchMessageFn = () => {},
} = {}) {
  return async function handleSendRequest(npub) {
    setSendingNpubFn(npub);
    setSearchMsgFn('');
    try {
      await sendFriendRequestFn(npub);
      setSentNpubsFn((previous) => new Set([...previous, npub]));
      setSearchMsgFn('Friend request sent!');
      clearSearchMessageFn(3000);
    } catch (error) {
      setSearchMsgFn(error?.message || 'Failed to send request');
      clearSearchMessageFn(4000);
    }
    setSendingNpubFn(null);
  };
}

export function createFollowingModalRequestDecisionAction({
  requestActionFn = async () => {},
  setActioningIdFn = () => {},
  setIncomingFn = () => {},
  onAcceptedFn = async () => {},
} = {}) {
  return async function handleRequestDecision(id) {
    setActioningIdFn(id);
    try {
      await requestActionFn(id);
      setIncomingFn((previous) => previous.filter((request) => request.id !== id));
      await onAcceptedFn();
    } catch {
      // ignore request-decision failures
    }
    setActioningIdFn(null);
  };
}

export function createFollowingModalRemoveFriendAction({
  removeContactFn = async () => [],
  setContactsFn = () => {},
  selectedNpub = null,
  setSelectedNpubFn = () => {},
} = {}) {
  return async function handleRemove(npub) {
    try {
      const nextContacts = await removeContactFn(npub);
      setContactsFn(nextContacts);
      if (selectedNpub === npub) {
        setSelectedNpubFn(null);
      }
    } catch {
      // ignore removal failures
    }
  };
}

export function createFollowingModalCopyNpubAction({
  writeTextFn = async () => {},
  setCopiedFn = () => {},
  setTimeoutFn = setTimeout,
} = {}) {
  return function handleCopyNpub(npub) {
    void writeTextFn(npub).then(() => {
      setCopiedFn(true);
      setTimeoutFn(() => setCopiedFn(false), 2000);
    });
  };
}

export function createFollowingModalCopyInviteAction({
  inviteText = '',
  writeTextFn = async () => {},
  setSearchMsgFn = () => {},
  clearSearchMessageFn = () => {},
  setInviteMenuNpubFn = () => {},
} = {}) {
  return function handleCopyInvite() {
    void writeTextFn(inviteText).then(() => {
      setSearchMsgFn('Invite link copied!');
      clearSearchMessageFn(3000);
    });
    setInviteMenuNpubFn(null);
  };
}

export function createFollowingModalSendNostrDmAction({
  setSendingDMFn = () => {},
  setInviteMenuNpubFn = () => {},
  decodeNpubFn = () => ({ data: null }),
  publishDMFn = async () => ({ ok: true }),
  inviteText = '',
  setSearchMsgFn = () => {},
  clearSearchMessageFn = () => {},
} = {}) {
  return async function handleSendNostrDM(npub) {
    setSendingDMFn(true);
    setInviteMenuNpubFn(null);
    try {
      const decoded = decodeNpubFn(npub);
      const result = await publishDMFn(decoded.data, inviteText);
      if (result.ok) {
        setSearchMsgFn('Invite DM sent via Nostr!');
      } else {
        setSearchMsgFn(result.error || 'Failed to send DM');
      }
    } catch {
      setSearchMsgFn('Failed to send DM');
    }
    setSendingDMFn(false);
    clearSearchMessageFn(4000);
  };
}

export function openFollowingModalPrimalProfile({
  npub = '',
  openExternalFn = () => {},
} = {}) {
  openExternalFn(`https://primal.net/p/${npub}`);
}
