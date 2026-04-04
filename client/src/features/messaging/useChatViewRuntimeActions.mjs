import { useCallback, useMemo } from 'react';

import { createTrustContactAction } from './chatViewTrustFlow.mjs';
import {
  buildChatViewSendHandlerInput,
  buildChatViewTrustActionInput,
  buildChatViewTrustUiHandlersInput,
} from './chatViewRuntimeInputs.mjs';
import {
  createChatViewSendHandler,
  createChatViewTrustUiHandlers,
} from './chatViewRuntimeHandlers.mjs';

export function useChatViewRuntimeActions({
  effectiveConversation = null,
  trustedNpub = null,
  trustInput = '',
  trustError = '',
  sendMessageFn = async () => {},
  wasAtBottomRef,
  setTrustSavingFn = () => {},
  setTrustErrorFn = () => {},
  setTrustedNpubFn = () => {},
  setTrustInputFn = () => {},
  setShowVerifyModalFn = () => {},
  setKeyChangedFn = () => {},
  lookupUserByNpubFn,
  trustUserNpubFn,
} = {}) {
  const handleSend = useCallback(createChatViewSendHandler(buildChatViewSendHandlerInput({
    sendMessageFn,
    wasAtBottomRef,
  })), [sendMessageFn, wasAtBottomRef]);

  const handleTrustContact = useMemo(() => createTrustContactAction(buildChatViewTrustActionInput({
    effectiveConversation,
    trustInput,
    setTrustSavingFn,
    setTrustErrorFn,
    setTrustedNpubFn,
    setTrustInputFn,
    lookupUserByNpubFn,
    trustUserNpubFn,
  })), [
    effectiveConversation,
    lookupUserByNpubFn,
    setTrustErrorFn,
    setTrustInputFn,
    setTrustSavingFn,
    setTrustedNpubFn,
    trustInput,
    trustUserNpubFn,
  ]);

  const {
    onTrustInputChange,
    onOpenVerifyModal,
    onCloseVerifyModal,
    onVerifiedIdentity,
  } = useMemo(() => createChatViewTrustUiHandlers(buildChatViewTrustUiHandlersInput({
    trustError,
    setTrustInputFn,
    setTrustErrorFn,
    setShowVerifyModalFn,
    setKeyChangedFn,
  })), [
    setKeyChangedFn,
    setShowVerifyModalFn,
    setTrustErrorFn,
    setTrustInputFn,
    trustError,
  ]);

  return {
    dmTrustRequired: effectiveConversation?.type === 'dm'
      && !effectiveConversation?.dmUnsupported
      && !trustedNpub,
    handleSend,
    handleTrustContact,
    onTrustInputChange,
    onOpenVerifyModal,
    onCloseVerifyModal,
    onVerifiedIdentity,
  };
}
