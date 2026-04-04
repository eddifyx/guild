import React from 'react';
import FilePreview from '../Chat/FilePreview';
import Avatar from '../Common/Avatar';
import {
  buildGuildChatTypingLabel,
  buildRenderableMentionRanges,
} from '../../features/messaging/guildChatMessageViewModel.mjs';

function formatTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatTimestampSeparator(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function renderMessageContent(message, currentUserId) {
  const content = String(message?.content || '');
  if (!content) {
    return null;
  }

  const mentionRanges = buildRenderableMentionRanges(message);
  if (mentionRanges.length === 0) {
    return content;
  }

  const fragments = [];
  let cursor = 0;

  for (const range of mentionRanges) {
    if (range.start > cursor) {
      fragments.push(
        <span key={`${range.key}-text`}>
          {content.slice(cursor, range.start)}
        </span>
      );
    }

    const isCurrentUserMention = !!currentUserId && range.userId === currentUserId;
    fragments.push(
      <span
        key={range.key}
        style={{
          display: 'inline',
          padding: '0 3px',
          borderRadius: 4,
          fontWeight: 700,
          letterSpacing: '0.01em',
          background: isCurrentUserMention ? 'rgba(255, 166, 77, 0.12)' : 'rgba(64, 255, 64, 0.09)',
          color: isCurrentUserMention ? '#ffb35c' : '#40FF40',
          boxShadow: isCurrentUserMention
            ? '0 0 0 1px rgba(255, 166, 77, 0.18), 0 0 12px rgba(255, 166, 77, 0.12)'
            : '0 0 0 1px rgba(64, 255, 64, 0.12)',
          textShadow: isCurrentUserMention
            ? '0 0 10px rgba(255, 166, 77, 0.16)'
            : '0 0 10px rgba(64, 255, 64, 0.14)',
        }}
      >
        {range.display || content.slice(range.start, range.end)}
      </span>
    );
    cursor = range.end;
  }

  if (cursor < content.length) {
    fragments.push(
      <span key={`${message?.id || 'message'}-tail`}>
        {content.slice(cursor)}
      </span>
    );
  }

  return fragments;
}

export function GuildChatMessageRow({ message, continued = false, currentUserId = null }) {
  if (message?.type === 'timestamp-separator') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px 6px',
          opacity: 0.92,
        }}
      >
        <div style={{ flex: 1, height: 1, background: 'rgba(64, 255, 64, 0.1)' }} />
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'rgba(128, 214, 128, 0.78)',
            whiteSpace: 'nowrap',
          }}
        >
          {formatTimestampSeparator(message.createdAt)}
        </div>
        <div style={{ flex: 1, height: 1, background: 'rgba(64, 255, 64, 0.1)' }} />
      </div>
    );
  }

  const isMotd = message.type === 'motd';
  const baseTextColor = isMotd ? 'rgba(156, 255, 156, 0.96)' : 'rgba(223, 255, 223, 0.94)';
  const metaColor = isMotd ? 'rgba(112, 219, 112, 0.82)' : 'rgba(92, 181, 92, 0.78)';

  if (isMotd) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          alignItems: 'start',
          gap: 10,
          padding: '7px 10px',
          borderRadius: 10,
          background: 'rgba(64, 255, 64, 0.08)',
          border: '1px solid rgba(64, 255, 64, 0.14)',
          opacity: message.failed ? 0.72 : 1,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#40FF40',
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}
        >
          /
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              color: metaColor,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 2,
            }}
          >
            Message of the Day
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.4,
              color: message.failed ? '#ffb4b4' : baseTextColor,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </div>
          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <div style={{ marginTop: message.content ? 6 : 2, display: 'grid', gap: 6 }}>
              {message.attachments.map((attachment, index) => (
                <FilePreview
                  key={attachment.id || attachment.fileId || attachment.serverFileUrl || `${message.id}-att-${index}`}
                  attachment={attachment}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr)',
        alignItems: 'start',
        gap: 8,
        padding: continued ? '0 10px 1px' : '3px 10px 2px',
        borderRadius: 8,
        border: '1px solid transparent',
        opacity: message.failed ? 0.72 : 1,
      }}
    >
      {continued ? (
        <div aria-hidden="true" style={{ width: 24, minHeight: 0 }} />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 1,
          }}
        >
          <div style={{ '--accent': message.senderColor || '#40FF40' }}>
            <Avatar
              username={message.senderName}
              color={message.senderColor}
              size={22}
              profilePicture={message.senderPicture}
            />
          </div>
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        {!continued && (
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: message.content ? 0 : 0,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: baseTextColor,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {message.senderName}
            </span>
            <span
              style={{
                fontSize: 10,
                color: metaColor,
                whiteSpace: 'nowrap',
              }}
            >
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}
        {message.content && (
          <div
            style={{
              minWidth: 0,
              fontSize: 13,
              lineHeight: 1.22,
              color: message.failed ? '#ffb4b4' : baseTextColor,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {renderMessageContent(message, currentUserId)}
            {message.failed && (
              <span style={{ fontSize: 10, color: '#ff7d7d', marginLeft: 8 }}>
                failed
              </span>
            )}
          </div>
        )}
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div style={{ marginTop: message.content ? 4 : 1, display: 'grid', gap: 6 }}>
            {message.attachments.map((attachment, index) => (
              <FilePreview
                key={attachment.id || attachment.fileId || attachment.serverFileUrl || `${message.id}-att-${index}`}
                attachment={attachment}
                compact
              />
            ))}
          </div>
        )}
        {message.failed && !message.content && (
          <div style={{ fontSize: 10, color: '#ff7d7d', marginTop: 1 }}>
            failed
          </div>
        )}
      </div>
    </div>
  );
}

export function GuildChatTypingIndicator({ typingUsers }) {
  const label = buildGuildChatTypingLabel(typingUsers);
  if (!label) {
    return null;
  }

  return (
    <div
      style={{
        minHeight: 18,
        padding: '0 14px',
        fontSize: 11,
        color: 'rgba(118, 221, 118, 0.88)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span>{label}</span>
      <span className="guildchat-typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
      <style>{`
        .guildchat-typing-dots span {
          animation: guildchat-blink 1.35s infinite both;
        }
        .guildchat-typing-dots span:nth-child(2) { animation-delay: 0.18s; }
        .guildchat-typing-dots span:nth-child(3) { animation-delay: 0.36s; }
        @keyframes guildchat-blink {
          0%, 80%, 100% { opacity: 0.22; }
          40% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
