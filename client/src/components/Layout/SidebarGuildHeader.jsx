import React from 'react';
export default function SidebarGuildHeader({
  guildHeaderState = {},
  guildChatMentionUnread = false,
  onSelectTavern = () => {},
  onInvite = () => {},
  onOpenGuildSettings = () => {},
  onGuildImageError = () => {},
} = {}) {
  return (
    <div style={{
      padding: '8px 12px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }}>
      <button
        onClick={onSelectTavern}
        title="Open Tavern"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          flex: 1,
          background: guildHeaderState.isTavernActive ? 'rgba(64, 255, 64, 0.08)' : 'transparent',
          border: '1px solid',
          borderColor: guildHeaderState.isTavernActive ? 'rgba(64, 255, 64, 0.18)' : 'transparent',
          borderRadius: 10,
          cursor: 'pointer',
          padding: '8px 10px',
          textAlign: 'left',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(event) => {
          if (!guildHeaderState.isTavernActive) {
            event.currentTarget.style.background = 'rgba(64, 255, 64, 0.04)';
            event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.12)';
          }
        }}
        onMouseLeave={(event) => {
          if (!guildHeaderState.isTavernActive) {
            event.currentTarget.style.background = 'transparent';
            event.currentTarget.style.borderColor = 'transparent';
          }
        }}
      >
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          overflow: 'hidden',
          flexShrink: 0,
          background: guildHeaderState.guildImageUrl ? 'rgba(255,255,255,0.03)' : 'rgba(64, 255, 64, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(64, 255, 64, 0.12)',
        }}>
          {guildHeaderState.guildImageUrl ? (
            <img
              src={guildHeaderState.guildImageUrl}
              alt={guildHeaderState.guildDisplayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={onGuildImageError}
            />
          ) : (
            <span style={{
              fontSize: 17,
              fontWeight: 800,
              color: '#40FF40',
              textShadow: '0 0 10px rgba(64, 255, 64, 0.2)',
            }}>
              /
            </span>
          )}
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="truncate" style={{
            fontSize: 15,
            fontWeight: 700,
            color: guildHeaderState.guildNameColor,
            textShadow: guildHeaderState.guildNameTextShadow,
            letterSpacing: '-0.02em',
          }}>
            {guildHeaderState.guildDisplayName}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: guildHeaderState.tavernMetaColor,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            Tavern
            {guildChatMentionUnread && (
              <span
                aria-label="Unread /guildchat mention"
                title="Unread /guildchat mention"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: 'rgba(255, 166, 77, 0.16)',
                  color: '#ffd8a8',
                  boxShadow: '0 0 0 3px rgba(255, 166, 77, 0.12)',
                  flexShrink: 0,
                  fontSize: 10,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                @
              </span>
            )}
          </span>
        </div>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          onClick={onInvite}
          title="Invite to guild"
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            borderRadius: 4, transition: 'color 0.15s',
          }}
          onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </button>
        <button
          onClick={onOpenGuildSettings}
          title="Guild settings"
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
            borderRadius: 4, transition: 'color 0.15s',
          }}
          onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </div>
  );
}
