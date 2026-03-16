import { memo, useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { lookupUserByNpub } from '../../api';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { getKnownNpub, trustUserNpub } from '../../crypto/identityDirectory.js';
import { loadRemoteIdentityVerification } from '../../crypto/signalClient.js';
import { isE2EInitialized } from '../../crypto/sessionManager';
import { endPerfTraceAfterNextPaint } from '../../utils/devPerf';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import VerifyIdentityModal from './VerifyIdentityModal';

function ChatView({ conversation, openTraceId = null }) {
  const { user } = useAuth();
  const { currentGuildData, loading: guildLoading } = useGuild();
  const dmSupported = useMemo(() => {
    if (conversation?.type !== 'dm') return true;
    if (guildLoading) return true;
    return (currentGuildData?.members || []).some((member) => member.id === conversation.id);
  }, [conversation, currentGuildData, guildLoading]);
  const effectiveConversation = useMemo(() => (
    conversation?.type === 'dm' && !dmSupported
      ? { ...conversation, dmUnsupported: true }
      : conversation
  ), [conversation, dmSupported]);
  const dmUnavailable = effectiveConversation?.type === 'dm' && effectiveConversation?.dmUnsupported;
  const { messages, loading, hasMore, error: conversationError, sendMessage, loadMore, editMessage, deleteMessage } = useMessages(effectiveConversation, openTraceId);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const wasAtBottomRef = useRef(true);
  const scrollingRef = useRef(false);
  const pendingOlderLoadIdRef = useRef(0);
  const loadingOlderRef = useRef(false);
  const pendingInitialScrollRef = useRef(false);
  const [keyChanged, setKeyChanged] = useState(false);
  const [identityCheckError, setIdentityCheckError] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [trustedNpub, setTrustedNpub] = useState(() => effectiveConversation?.type === 'dm' ? getKnownNpub(effectiveConversation.id) : null);
  const [trustInput, setTrustInput] = useState('');
  const [trustError, setTrustError] = useState('');
  const [trustSaving, setTrustSaving] = useState(false);
  const completedOpenTraceIdsRef = useRef(new Set());

  useEffect(() => {
    setKeyChanged(false);
    setIdentityCheckError('');
    const nextTrusted = effectiveConversation?.type === 'dm' ? getKnownNpub(effectiveConversation.id) : null;
    setTrustedNpub(nextTrusted);
    setTrustInput(nextTrusted || '');
    setTrustError('');

    if (!effectiveConversation || effectiveConversation.type !== 'dm' || effectiveConversation.dmUnsupported || !isE2EInitialized() || !nextTrusted) return;
    let cancelled = false;
    (async () => {
      try {
        const { trustState } = await loadRemoteIdentityVerification(effectiveConversation.id);
        if (cancelled) return;
        setKeyChanged(trustState?.status === 'key_changed');
        setIdentityCheckError('');
      } catch (err) {
        if (cancelled) return;
        setKeyChanged(false);
        setIdentityCheckError(err?.message || 'Unable to confirm this contact\'s current identity.');
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveConversation]);

  useEffect(() => {
    if (!effectiveConversation || effectiveConversation.type !== 'dm' || effectiveConversation.dmUnsupported) return;
    const handleTrustUpdate = (event) => {
      if (event.detail?.userId !== effectiveConversation.id) return;
      setTrustedNpub(event.detail.npub || getKnownNpub(effectiveConversation.id));
      setTrustError('');
      setIdentityCheckError('');
    };
    const handleIdentityVerified = (event) => {
      if (event.detail?.userId !== effectiveConversation.id) return;
      setKeyChanged(false);
      setIdentityCheckError('');
      setShowVerifyModal(false);
    };
    window.addEventListener('trusted-npub-updated', handleTrustUpdate);
    window.addEventListener('identity-verified', handleIdentityVerified);
    return () => {
      window.removeEventListener('trusted-npub-updated', handleTrustUpdate);
      window.removeEventListener('identity-verified', handleIdentityVerified);
    };
  }, [effectiveConversation]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    if (!conversation) return;
    wasAtBottomRef.current = true;
    pendingOlderLoadIdRef.current += 1;
    loadingOlderRef.current = false;
    pendingInitialScrollRef.current = true;
    const frameId = requestAnimationFrame(() => {
      if (wasAtBottomRef.current) {
        scrollToBottom();
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [conversation, scrollToBottom]);

  useEffect(() => {
    if (messages.length === 0 || !wasAtBottomRef.current || scrollingRef.current) return;
    const frameId = requestAnimationFrame(() => {
      if (wasAtBottomRef.current && !scrollingRef.current) {
        scrollToBottom();
      }
    });
    return () => cancelAnimationFrame(frameId);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    if (!conversation || !pendingInitialScrollRef.current) return;
    const frameId = requestAnimationFrame(() => {
      scrollToBottom();
      pendingInitialScrollRef.current = false;
    });
    return () => cancelAnimationFrame(frameId);
  }, [conversation, messages, scrollToBottom]);

  useEffect(() => {
    if (!openTraceId || loading) return;
    if (completedOpenTraceIdsRef.current.has(openTraceId)) return;

    completedOpenTraceIdsRef.current.add(openTraceId);
    endPerfTraceAfterNextPaint(openTraceId, {
      status: 'ready',
      surface: 'chat-view',
      conversationType: effectiveConversation?.type || null,
      messageCount: messages.length,
      hasError: Boolean(conversationError || dmUnavailable),
    });
  }, [openTraceId, loading, effectiveConversation?.type, messages.length, conversationError, dmUnavailable]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    const isNearTop = el.scrollTop < 50;
    wasAtBottomRef.current = isNearBottom;

    if (!isNearTop) {
      pendingOlderLoadIdRef.current += 1;
    }

    if (scrollingRef.current || loadingOlderRef.current) return;
    if (isNearTop && hasMore && !loading) {
      const prevHeight = el.scrollHeight;
      const shouldStickToTop = el.scrollTop <= 4;
      const activeLoadId = pendingOlderLoadIdRef.current + 1;
      pendingOlderLoadIdRef.current = activeLoadId;
      loadingOlderRef.current = true;

      loadMore().then(() => {
        if (pendingOlderLoadIdRef.current !== activeLoadId) return;
        if (scrollRef.current !== el) return;
        if (el.scrollTop >= 50 || wasAtBottomRef.current) return;

        requestAnimationFrame(() => {
          if (pendingOlderLoadIdRef.current !== activeLoadId) return;
          if (scrollRef.current !== el) return;
          if (el.scrollTop >= 50 || wasAtBottomRef.current) return;
          if (shouldStickToTop) {
            el.scrollTop = 0;
            return;
          }
          el.scrollTop = el.scrollHeight - prevHeight;
        });
      }).finally(() => {
        loadingOlderRef.current = false;
      });
    }
  }, [hasMore, loading, loadMore]);

  const handleSend = useCallback(async (content, attachments) => {
    await sendMessage(content, attachments);
    wasAtBottomRef.current = true;
  }, [sendMessage]);

  const handleTrustContact = useCallback(async () => {
    if (!effectiveConversation || effectiveConversation.type !== 'dm' || effectiveConversation.dmUnsupported) return;
    const npub = trustInput.trim();
    if (!npub.startsWith('npub1')) {
      setTrustError('Enter a valid npub to save this contact\'s Nostr identity.');
      return;
    }

    setTrustSaving(true);
    setTrustError('');
    try {
      const userRecord = await lookupUserByNpub(npub);
      if (!userRecord) {
        throw new Error('That npub is not registered on this server.');
      }
      if (userRecord.id !== effectiveConversation.id) {
        throw new Error('That npub belongs to a different account than this DM.');
      }
      if (!trustUserNpub(effectiveConversation.id, npub)) {
        throw new Error('This contact already has a different trusted npub pinned.');
      }
      setTrustedNpub(npub);
      setTrustInput(npub);
    } catch (err) {
      setTrustError(err?.message || 'Failed to trust this contact.');
    } finally {
      setTrustSaving(false);
    }
  }, [effectiveConversation, trustInput]);

  if (!conversation) {
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

  const dmTrustRequired = effectiveConversation.type === 'dm' && !effectiveConversation.dmUnsupported && !trustedNpub;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
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
            onClick={() => setShowVerifyModal(true)}
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
          onClose={() => { setShowVerifyModal(false); }}
          onVerified={() => {
            setKeyChanged(false);
            setShowVerifyModal(false);
          }}
        />
      )}
      <div
        key={`${effectiveConversation.type}:${effectiveConversation.id}`}
        ref={scrollRef}
        onScroll={handleScroll}
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
        <div style={{ overflowAnchor: 'none' }}>
          {loading && messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
              Loading messages...
            </div>
          )}

          {loading && messages.length > 0 && hasMore && (
            <div style={{
              textAlign: 'center',
              padding: 8,
              color: 'var(--text-muted)',
              fontSize: 11,
            }}>
              Loading older messages...
            </div>
          )}

          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const prevSameSender = prev && prev.sender_id === msg.sender_id;
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user.userId}
                prevSameSender={prevSameSender}
                onEdit={editMessage}
                onDelete={deleteMessage}
              />
            );
          })}
        </div>
        <div ref={bottomRef} style={{ height: 1, overflowAnchor: 'auto' }} />
      </div>

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
              Secure DM is waiting for this contact's Nostr identity. If they already share a guild or conversation history with you, it should appear automatically. Otherwise, paste their verified npub here to continue.
            </div>
            <input
              type="text"
              value={trustInput}
              onChange={(e) => { setTrustInput(e.target.value); if (trustError) setTrustError(''); }}
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
                onClick={handleTrustContact}
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
          <MessageInput onSend={handleSend} conversation={effectiveConversation} />
        )}
      </div>
    </div>
  );
}

export default memo(ChatView);
