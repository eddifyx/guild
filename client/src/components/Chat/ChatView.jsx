import React, { memo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import {
  ChatViewAlerts,
  ChatViewComposer,
  ChatViewEmptyState,
  ChatViewMessageScroller,
} from './ChatViewPanels.jsx';
import { useChatViewRuntime } from '../../features/messaging/useChatViewRuntime.mjs';

function ChatView({ conversation, openTraceId = null }) {
  const { user } = useAuth();
  const { currentGuildData, loading: guildLoading } = useGuild();
  const {
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
    onScroll,
    onSend,
    onTrustInputChange,
    onTrustContact,
    onOpenVerifyModal,
    onCloseVerifyModal,
    onVerifiedIdentity,
  } = useChatViewRuntime({
    conversation,
    currentGuildData,
    guildLoading,
    openTraceId,
  });

  if (!conversation) {
    return <ChatViewEmptyState />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
      <ChatViewAlerts
        dmUnavailable={dmUnavailable}
        conversationError={conversationError}
        identityCheckError={identityCheckError}
        dmTrustRequired={dmTrustRequired}
        keyChanged={keyChanged}
        showVerifyModal={showVerifyModal}
        effectiveConversation={effectiveConversation}
        onOpenVerifyModal={onOpenVerifyModal}
        onCloseVerifyModal={onCloseVerifyModal}
        onVerifiedIdentity={onVerifiedIdentity}
      />

      <ChatViewMessageScroller
        effectiveConversation={effectiveConversation}
        loading={loading}
        visibleMessages={messages}
        hasMore={hasMore}
        scrollRef={scrollRef}
        messagesContentRef={messagesContentRef}
        bottomRef={bottomRef}
        userId={user.userId}
        onScroll={onScroll}
        onEdit={editMessage}
        onDelete={deleteMessage}
      />

      <ChatViewComposer
        effectiveConversation={effectiveConversation}
        dmUnavailable={dmUnavailable}
        dmTrustRequired={dmTrustRequired}
        trustInput={trustInput}
        trustError={trustError}
        trustSaving={trustSaving}
        onTrustInputChange={onTrustInputChange}
        onTrustContact={onTrustContact}
        onSend={onSend}
      />
    </div>
  );
}

export default memo(ChatView);
