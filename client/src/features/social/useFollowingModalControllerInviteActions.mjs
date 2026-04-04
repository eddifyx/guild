import { useCallback } from 'react';

import { publishDM } from '../../nostr/profilePublisher';
import { nip19 } from 'nostr-tools';

import {
  createFollowingModalCopyInviteAction,
  createFollowingModalCopyNpubAction,
  createFollowingModalSendNostrDmAction,
  openFollowingModalPrimalProfile,
} from './followingModalActionRuntime.mjs';
import { getFollowingModalResultActionState } from './followingModalModel.mjs';
import {
  FOLLOWING_MODAL_INVITE_TEXT,
  toggleFollowingModalInviteMenu,
} from './followingModalRuntime.mjs';

export function useFollowingModalControllerInviteActions({
  state = {},
  viewState = {},
  clearSearchMessage = () => {},
} = {}) {
  const {
    setSentNpubs = () => {},
    selectedNpub = null,
    setSelectedNpub = () => {},
    setSearchMsg = () => {},
    setCopied = () => {},
    setInviteMenuNpub = () => {},
    inviteMenuNpub = null,
    guildNpubs = new Set(),
    sentNpubs = new Set(),
    sendingNpub = null,
    setSendingDM = () => {},
    sendingDM = false,
  } = state;

  const {
    friendNpubs = new Set(),
  } = viewState;

  const handleCopyNpub = useCallback((npub) => {
    createFollowingModalCopyNpubAction({
      writeTextFn: navigator.clipboard.writeText.bind(navigator.clipboard),
      setCopiedFn: setCopied,
      setTimeoutFn: setTimeout,
    })(npub);
  }, [setCopied]);

  const handleCopyInvite = useCallback(() => {
    createFollowingModalCopyInviteAction({
      inviteText: FOLLOWING_MODAL_INVITE_TEXT,
      writeTextFn: navigator.clipboard.writeText.bind(navigator.clipboard),
      setSearchMsgFn: setSearchMsg,
      clearSearchMessageFn: clearSearchMessage,
      setInviteMenuNpubFn: setInviteMenuNpub,
    })();
  }, [clearSearchMessage, setInviteMenuNpub, setSearchMsg]);

  const handleSendNostrDM = useCallback(async (npub) => {
    return createFollowingModalSendNostrDmAction({
      setSendingDMFn: setSendingDM,
      setInviteMenuNpubFn: setInviteMenuNpub,
      decodeNpubFn: nip19.decode,
      publishDMFn: publishDM,
      inviteText: FOLLOWING_MODAL_INVITE_TEXT,
      setSearchMsgFn: setSearchMsg,
      clearSearchMessageFn: clearSearchMessage,
    })(npub);
  }, [
    clearSearchMessage,
    setInviteMenuNpub,
    setSearchMsg,
    setSendingDM,
  ]);

  const handleToggleInviteMenu = useCallback((npub) => {
    setInviteMenuNpub((current) => toggleFollowingModalInviteMenu(current, npub));
  }, [setInviteMenuNpub]);

  const handleToggleSelectedFriend = useCallback((npub) => {
    setSelectedNpub((current) => (current === npub ? null : npub));
    setCopied(false);
  }, [setCopied, setSelectedNpub]);

  const handleOpenPrimal = useCallback((npub) => {
    openFollowingModalPrimalProfile({
      npub,
      openExternalFn: window.electronAPI?.openExternal,
    });
  }, []);

  const getResultActionState = useCallback((npub) => getFollowingModalResultActionState({
    npub,
    friendNpubs,
    sentNpubs,
    guildNpubs,
    sendingNpub,
    sendingDM,
    inviteMenuNpub,
  }), [
    friendNpubs,
    guildNpubs,
    inviteMenuNpub,
    sendingDM,
    sendingNpub,
    sentNpubs,
  ]);

  return {
    getResultActionState,
    onCopyNpub: handleCopyNpub,
    onCopyInvite: handleCopyInvite,
    onSendNostrDM: handleSendNostrDM,
    onToggleInviteMenu: handleToggleInviteMenu,
    onToggleSelectedFriend: handleToggleSelectedFriend,
    onOpenPrimal: handleOpenPrimal,
  };
}
