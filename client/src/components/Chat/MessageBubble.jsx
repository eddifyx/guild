import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../Common/Avatar';
import FilePreview from './FilePreview';
import { getConversationDecryptFailureMessage } from '../../features/messaging/messageDecryptPresentation.mjs';

export default function MessageBubble({ message, isOwn, showHeader, prevSameSender, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const editRef = useRef(null);
  const displayName = (message.sender_name || '').trim() || 'Unknown member';

  const time = (() => {
    try {
      const d = new Date(message.created_at.replace(' ', 'T') + 'Z');
      return formatDistanceToNow(d, { addSuffix: true });
    } catch {
      return '';
    }
  })();

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editing]);

  const handleStartEdit = () => {
    setEditText(message.content || '');
    setEditing(true);
    setConfirming(false);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content && onEdit) {
      onEdit(message.id, trimmed);
    }
    setEditing(false);
  };

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) onDelete(message.id);
    setConfirming(false);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirming(false); }}
      style={{
        display: 'flex',
        gap: 10,
        padding: prevSameSender ? '1px 16px' : '8px 16px',
        alignItems: 'flex-start',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.1s',
        position: 'relative',
      }}
    >
      <div style={{ width: 36, minWidth: 36 }}>
        {!prevSameSender && (
          <Avatar
            username={displayName}
            color={message.sender_color}
            size={36}
            profilePicture={message.sender_picture}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!prevSameSender && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--text-primary)',
            }}>
              {displayName}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{time}</span>
          </div>
        )}

        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={1}
              style={{
                flex: 1,
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 10px',
                fontSize: 13,
                lineHeight: 1.55,
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <button onClick={handleSaveEdit} style={actionBtnStyle('#06d6a0')} title="Save">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <button onClick={() => setEditing(false)} style={actionBtnStyle('var(--text-muted)')} title="Cancel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ) : (
          <>
            {message._decryptionPending ? (
              <div style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4" />
                  <path d="m16.2 7.8 2.9-2.9" />
                  <path d="M18 12h4" />
                  <path d="m16.2 16.2 2.9 2.9" />
                  <path d="M12 18v4" />
                  <path d="m4.9 19.1 2.9-2.9" />
                  <path d="M2 12h4" />
                  <path d="m4.9 4.9 2.9 2.9" />
                </svg>
                Unlocking secure message...
              </div>
            ) : message._decryptionFailed ? (
              <div style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: '#e94560',
                fontStyle: 'italic',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                {message._decryptionError || getConversationDecryptFailureMessage(message._decryptionBucket)}
              </div>
            ) : message.content ? (
              <div className="message-text" style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--text-primary)',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}>
                {message.content}
                {message.edited_at && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>(edited)</span>
                )}
              </div>
            ) : null}
          </>
        )}

        {/* Encrypted attachments should only render from decrypted payload metadata. */}
        {message._decryptedAttachments && message._decryptedAttachments.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {message._decryptedAttachments.map((att, i) => (
              <FilePreview key={i} attachment={att} />
            ))}
          </div>
        )}
        {!message.encrypted &&
          (!message._decryptedAttachments || message._decryptedAttachments.length === 0) &&
          message.attachments && message.attachments.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {message.attachments.map((att, i) => (
              <FilePreview key={att.id || i} attachment={att} />
            ))}
          </div>
        )}
      </div>

      {/* Action buttons on hover for own messages */}
      {isOwn && hovered && !editing && (
        <div style={{
          position: 'absolute',
          top: 2,
          right: 16,
          display: 'flex',
          gap: 2,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: 2,
        }}>
          {message.content && !message._decrypted && !message._decryptionFailed && (
            <button onClick={handleStartEdit} style={actionBtnStyle('var(--text-muted)')} title="Edit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {confirming ? (
            <>
              <span style={{ fontSize: 11, color: '#e94560', padding: '2px 4px', lineHeight: '24px' }}>Delete?</span>
              <button onClick={handleDelete} style={actionBtnStyle('#e94560')} title="Confirm delete">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button onClick={() => setConfirming(false)} style={actionBtnStyle('var(--text-muted)')} title="Cancel">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </>
          ) : (
            <button onClick={() => setConfirming(true)} style={actionBtnStyle('var(--text-muted)')} title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function actionBtnStyle(color) {
  return {
    background: 'none',
    border: 'none',
    color,
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}
