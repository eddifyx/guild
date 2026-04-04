import React from 'react';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import VerifyIdentityModal from './VerifyIdentityModal';
import { shouldGroupWithPreviousMessage } from '../../features/messaging/chatViewModel.mjs';

export function ChatViewEmptyState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--text-muted)',
      gap: 8,
    }}>
      <span style={{ fontSize: 24 }}>#</span>
      <span style={{ fontSize: 13 }}>Select a conversation</span>
    </div>
  );
}

export function ChatViewAlerts({
  dmUnavailable,
  conversationError,
  identityCheckError,
  dmTrustRequired,
  keyChanged,
  showVerifyModal,
  effectiveConversation,
  onOpenVerifyModal,
  onCloseVerifyModal,
  onVerifiedIdentity,
}) {
  return (
    <>
      {dmUnavailable && (
        <div style={{
          padding: '8px 12px', background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          fontSize: 11, color: '#ef4444', flexShrink: 0,
        }}>
          Direct messages are only available while you share a guild with this user.
        </div>
      )}
      {conversationError && !dmUnavailable && (
        <div style={{
          padding: '6px 12px', background: 'rgba(245, 158, 11, 0.12)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.24)',
          fontSize: 11, color: '#f59e0b', display: 'flex',
          alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <span>{conversationError}</span>
        </div>
      )}
      {identityCheckError && !dmUnavailable && !dmTrustRequired && !keyChanged && (
        <div style={{
          padding: '6px 12px', background: 'rgba(245, 158, 11, 0.12)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.24)',
          fontSize: 11, color: '#f59e0b', display: 'flex',
          alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <span>Secure identity check failed: {identityCheckError}</span>
        </div>
      )}
      {keyChanged && (
        <div style={{
          padding: '6px 12px', background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          fontSize: 11, color: '#ef4444', display: 'flex',
          alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Safety number has changed. Verify their identity.</span>
          <button
            onClick={onOpenVerifyModal}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', borderRadius: 4, padding: '2px 8px', fontSize: 10,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Verify
          </button>
        </div>
      )}
      {showVerifyModal && effectiveConversation?.type === 'dm' && !effectiveConversation?.dmUnsupported && (
        <VerifyIdentityModal
          userId={effectiveConversation.id}
          username=""
          onClose={onCloseVerifyModal}
          onVerified={onVerifiedIdentity}
        />
      )}
    </>
  );
}

export function ChatViewMessageScroller({
  effectiveConversation,
  loading,
  visibleMessages,
  hasMore,
  scrollRef,
  messagesContentRef,
  bottomRef,
  userId,
  onScroll,
  onEdit,
  onDelete,
}) {
  return (
    <div
      key={`${effectiveConversation.type}:${effectiveConversation.id}`}
      ref={scrollRef}
      onScroll={onScroll}
      style={{
        flex: 1,
        overflowY: 'auto',
        paddingTop: 8,
        paddingBottom: 8,
        WebkitUserSelect: 'text',
        userSelect: 'text',
        cursor: 'text',
      }}
    >
      <div ref={messagesContentRef} style={{ overflowAnchor: 'none' }}>
        {loading && visibleMessages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            Loading messages...
          </div>
        )}

        {loading && visibleMessages.length > 0 && hasMore && (
          <div style={{
            textAlign: 'center',
            padding: 8,
            color: 'var(--text-muted)',
            fontSize: 11,
          }}>
            Loading older messages...
          </div>
        )}

        {visibleMessages.map((message, index) => {
          const previousMessage = visibleMessages[index - 1];
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender_id === userId}
              prevSameSender={shouldGroupWithPreviousMessage(previousMessage, message)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>
      <div ref={bottomRef} style={{ height: 1, overflowAnchor: 'auto' }} />
    </div>
  );
}

export function ChatViewComposer({
  effectiveConversation,
  dmUnavailable,
  dmTrustRequired,
  trustInput,
  trustError,
  trustSaving,
  onTrustInputChange,
  onTrustContact,
  onSend,
}) {
  return (
    <div style={{ position: 'relative' }}>
      <TypingIndicator conversation={effectiveConversation} />
      {dmUnavailable ? (
        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: 16,
          color: 'var(--text-muted)',
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          This conversation is unavailable because you no longer share a guild with this user.
        </div>
      ) : dmTrustRequired ? (
        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}>
          <div style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.22)',
            color: '#f59e0b',
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            Secure DM is waiting for this contact&apos;s Nostr identity. If they already share a guild or conversation history with you, it should appear automatically. Otherwise, paste their verified npub here to continue.
          </div>
          <input
            type="text"
            value={trustInput}
            onChange={(event) => onTrustInputChange(event.target.value)}
            placeholder="npub1..."
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
          {trustError && (
            <div style={{ fontSize: 11, color: '#ef4444' }}>
              {trustError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={onTrustContact}
              disabled={trustSaving}
              style={{
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 14px',
                cursor: trustSaving ? 'default' : 'pointer',
                color: '#050705',
                fontSize: 12,
                fontWeight: 600,
                opacity: trustSaving ? 0.7 : 1,
              }}
            >
              {trustSaving ? 'Saving...' : 'Save Nostr Identity'}
            </button>
          </div>
        </div>
      ) : (
        <MessageInput onSend={onSend} conversation={effectiveConversation} />
      )}
    </div>
  );
}
