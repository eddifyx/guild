import { useCallback } from 'react';

import {
  acceptFriendRequest,
  rejectFriendRequest,
  removeContact,
  sendFriendRequest,
} from '../../api';

import {
  createFollowingModalRemoveFriendAction,
  createFollowingModalRequestDecisionAction,
  createFollowingModalSendRequestAction,
} from './followingModalActionRuntime.mjs';

export function useFollowingModalControllerRequestActions({
  state = {},
  clearSearchMessage = () => {},
} = {}) {
  const {
    setContacts = () => {},
    setIncoming = () => {},
    setSentNpubs = () => {},
    selectedNpub = null,
    setSelectedNpub = () => {},
    setSearchMsg = () => {},
    setSendingNpub = () => {},
    setActioningId = () => {},
  } = state;

  const handleSendRequest = useCallback(async (npub) => {
    return createFollowingModalSendRequestAction({
      sendFriendRequestFn: sendFriendRequest,
      setSendingNpubFn: setSendingNpub,
      setSearchMsgFn: setSearchMsg,
      setSentNpubsFn: setSentNpubs,
      clearSearchMessageFn: clearSearchMessage,
    })(npub);
  }, [clearSearchMessage, setSearchMsg, setSendingNpub, setSentNpubs]);

  const handleAccept = useCallback(async (id) => {
    return createFollowingModalRequestDecisionAction({
      requestActionFn: acceptFriendRequest,
      setActioningIdFn: setActioningId,
      setIncomingFn: setIncoming,
    })(id);
  }, [setActioningId, setIncoming]);

  const handleReject = useCallback(async (id) => {
    return createFollowingModalRequestDecisionAction({
      requestActionFn: rejectFriendRequest,
      setActioningIdFn: setActioningId,
      setIncomingFn: setIncoming,
    })(id);
  }, [setActioningId, setIncoming]);

  const handleRemove = useCallback(async (npub) => {
    return createFollowingModalRemoveFriendAction({
      removeContactFn: removeContact,
      setContactsFn: setContacts,
      selectedNpub,
      setSelectedNpubFn: setSelectedNpub,
    })(npub);
  }, [selectedNpub, setContacts, setSelectedNpub]);

  return {
    onSendRequest: handleSendRequest,
    onAcceptRequest: handleAccept,
    onRejectRequest: handleReject,
    onRemoveFriend: handleRemove,
  };
}
