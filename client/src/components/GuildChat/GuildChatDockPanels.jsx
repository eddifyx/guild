import React from 'react';
import {
  GuildChatMessageRow,
  GuildChatTypingIndicator,
} from './GuildChatMessageView.jsx';
import {
  GUILD_CHAT_FILE_LIMIT_LABEL,
} from '../../features/messaging/guildChatComposerFlow.mjs';
import { shouldContinueGuildChatMessage } from '../../features/messaging/guildChatDockModel.mjs';

export function GuildChatDockDragOverlay({
  dragActive = false,
  hidden = false,
} = {}) {
  if (!dragActive || hidden) {
    return null;
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 4,
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, rgba(8, 22, 8, 0.82), rgba(5, 15, 5, 0.9))',
      border: '2px dashed rgba(64, 255, 64, 0.45)',
      boxShadow: 'inset 0 0 0 1px rgba(64, 255, 64, 0.12)',
    }}>
      <div style={{
        padding: '18px 22px',
        borderRadius: 16,
        background: 'rgba(3, 10, 3, 0.84)',
        border: '1px solid rgba(64, 255, 64, 0.2)',
        textAlign: 'center',
        color: '#d7ffd7',
        boxShadow: '0 18px 36px rgba(0, 0, 0, 0.28)',
      }}>
        <div style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#40FF40',
          textShadow: '0 0 14px rgba(64, 255, 64, 0.18)',
          marginBottom: 6,
        }}>
          Drop into /guildchat
        </div>
        <div style={{ fontSize: 12, color: 'rgba(188, 244, 188, 0.9)' }}>
          Images and files up to {GUILD_CHAT_FILE_LIMIT_LABEL}. Use Asset Dump for larger uploads.
        </div>
      </div>
    </div>
  );
}

export function GuildChatDockHeader({
  fullscreen = false,
  onToggleExpand = null,
} = {}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '8px 14px 7px',
      borderBottom: '1px solid rgba(64, 255, 64, 0.08)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{
          fontSize: 16,
          fontWeight: 800,
          color: '#40FF40',
          textShadow: '0 0 14px rgba(64, 255, 64, 0.18)',
          letterSpacing: '-0.03em',
        }}>
          /guildchat
        </span>
        {typeof onToggleExpand === 'function' && (
          <button
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            onClick={onToggleExpand}
            title={fullscreen ? 'Collapse /guildchat' : 'Expand /guildchat'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 999,
              border: '1px solid rgba(64, 255, 64, 0.16)',
              background: 'rgba(10, 15, 10, 0.52)',
              color: 'rgba(215, 255, 215, 0.84)',
              cursor: 'pointer',
              transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
              padding: 0,
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.28)';
              event.currentTarget.style.color = '#40FF40';
              event.currentTarget.style.background = 'rgba(16, 24, 16, 0.78)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.16)';
              event.currentTarget.style.color = 'rgba(215, 255, 215, 0.84)';
              event.currentTarget.style.background = 'rgba(10, 15, 10, 0.52)';
            }}
          >
            {fullscreen ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <polyline points="21 15 21 21 15 21" />
                <polyline points="3 9 3 3 9 3" />
                <line x1="14" y1="10" x2="21" y2="3" />
                <line x1="3" y1="21" x2="10" y2="14" />
                <line x1="14" y1="14" x2="21" y2="21" />
                <line x1="3" y1="3" x2="10" y2="10" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function GuildChatDockFeed({
  feedRef,
  dockSpacing = false,
  liveEntries = [],
  currentUserId = null,
  typingUsers = [],
  onScroll = () => {},
} = {}) {
  return (
    <>
      <div
        ref={feedRef}
        onScroll={onScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: dockSpacing ? '8px 10px 6px' : '12px 14px 8px',
          scrollbarGutter: 'stable',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {liveEntries.map((message, index) => {
          const previousMessage = liveEntries[index - 1];
          const continued = shouldContinueGuildChatMessage(previousMessage, message);
          return (
            <GuildChatMessageRow
              key={message.id}
              message={message}
              continued={continued}
              currentUserId={currentUserId}
            />
          );
        })}
      </div>

      <GuildChatTypingIndicator typingUsers={typingUsers} />
    </>
  );
}

export { GuildChatDockComposerPanel } from './GuildChatDockComposerPanel.jsx';
