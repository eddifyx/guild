import { lookupUserByNpub } from '../../api';
import { getKnownNpub, trustUserNpub } from '../../crypto/identityDirectory.js';
import { useMessages } from '../../hooks/useMessages';
import {
  buildChatViewRuntimeValue,
} from './chatViewRuntimeInputs.mjs';
import { useChatViewOpenTraceEffect } from './useChatViewOpenTraceEffect.mjs';
import { useChatViewRuntimeDerivedState } from './useChatViewRuntimeDerivedState.mjs';
import { useChatViewRuntimeActions } from './useChatViewRuntimeActions.mjs';
import { useChatViewScrollController } from './useChatViewScrollController.mjs';
import { useChatViewRuntimeState } from './useChatViewRuntimeState.mjs';
import { useChatViewTrustEffects } from './useChatViewTrustEffects.mjs';

export function useChatViewRuntime({
  conversation,
  currentGuildData = null,
  guildLoading = false,
  openTraceId = null,
}) {
  const {
    effectiveConversation,
    dmUnavailable,
    trustBootstrapState,
  } = useChatViewRuntimeDerivedState({
    conversation,
    currentGuildData,
    guildLoading,
    getKnownNpubFn: getKnownNpub,
  });

  const {
    messages,
    loading,
    hasMore,
    error: conversationError,
    sendMessage,
    loadMore,
    editMessage,
    deleteMessage,
  } = useMessages(effectiveConversation, openTraceId);

  const {
    keyChanged,
    setKeyChanged,
    identityCheckError,
    setIdentityCheckError,
    showVerifyModal,
    setShowVerifyModal,
    trustedNpub,
    setTrustedNpub,
    trustInput,
    setTrustInput,
    trustError,
    setTrustError,
    trustSaving,
    setTrustSaving,
    bottomRef,
    scrollRef,
    messagesContentRef,
    wasAtBottomRef,
    scrollingRef,
    pendingOlderLoadIdRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    initialScrollReleaseTimerRef,
    initialScrollPinnedUntilRef,
    completedOpenTraceIdsRef,
  } = useChatViewRuntimeState({
    trustBootstrapState,
  });

  useChatViewTrustEffects({
    effectiveConversation,
    trustBootstrapState,
    setKeyChangedFn: setKeyChanged,
    setIdentityCheckErrorFn: setIdentityCheckError,
    setTrustedNpubFn: setTrustedNpub,
    setTrustInputFn: setTrustInput,
    setTrustErrorFn: setTrustError,
    setShowVerifyModalFn: setShowVerifyModal,
    getKnownNpubFn: getKnownNpub,
  });

  useChatViewOpenTraceEffect({
    openTraceId,
    loading,
    completedOpenTraceIdsRef,
    conversationType: effectiveConversation?.type || null,
    messageCount: messages.length,
    hasError: Boolean(conversationError || dmUnavailable),
  });

  const handleScroll = useChatViewScrollController({
    conversation,
    messagesLength: messages.length,
    scrollRef,
    messagesContentRef,
    wasAtBottomRef,
    scrollingRef,
    pendingOlderLoadIdRef,
    loadingOlderRef,
    pendingInitialScrollRef,
    initialScrollReleaseTimerRef,
    initialScrollPinnedUntilRef,
    hasMore,
    loading,
    loadMoreFn: loadMore,
  });

  const {
    dmTrustRequired,
    handleSend,
    handleTrustContact,
    onTrustInputChange,
    onOpenVerifyModal,
    onCloseVerifyModal,
    onVerifiedIdentity,
  } = useChatViewRuntimeActions({
    effectiveConversation,
    trustedNpub,
    trustInput,
    trustError,
    sendMessageFn: sendMessage,
    wasAtBottomRef,
    setTrustSavingFn: setTrustSaving,
    setTrustErrorFn: setTrustError,
    setTrustedNpubFn: setTrustedNpub,
    setTrustInputFn: setTrustInput,
    setShowVerifyModalFn: setShowVerifyModal,
    setKeyChangedFn: setKeyChanged,
    lookupUserByNpubFn: lookupUserByNpub,
    trustUserNpubFn: trustUserNpub,
  });

  return buildChatViewRuntimeValue({
    effectiveConversation,
    dmUnavailable,
    messages,
    loading,
    hasMore,
    conversationError,
    editMessage,
    deleteMessage,
    bottomRef,
    scrollRef,
    messagesContentRef,
    keyChanged,
    identityCheckError,
    showVerifyModal,
    trustInput,
    trustError,
    trustSaving,
    dmTrustRequired,
    onScroll: handleScroll,
    onSend: handleSend,
    onTrustInputChange,
    onTrustContact: handleTrustContact,
    onOpenVerifyModal,
    onCloseVerifyModal,
    onVerifiedIdentity,
  });
}
