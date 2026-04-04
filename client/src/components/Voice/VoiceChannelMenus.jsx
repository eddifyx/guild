import React from 'react';
import { buildVoiceVolumeMenuState } from '../../features/voice/voiceChannelListModel.mjs';

export function VoiceChannelContextMenu({
  channelContextMenu = null,
  menuRef = null,
  channelAdminHandlers,
} = {}) {
  if (!channelContextMenu) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: channelContextMenu.y,
        left: channelContextMenu.x,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-strong)',
        borderRadius: 6,
        padding: 4,
        zIndex: 2000,
        minWidth: 150,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        animation: 'fadeIn 0.1s ease-out',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        onClick={() => {
          channelAdminHandlers.openRenameModal(channelContextMenu.channel);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: 12,
          textAlign: 'left',
          transition: 'all 0.1s',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--bg-hover)';
          event.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'transparent';
          event.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Rename
      </button>
      <button
        onClick={() => {
          channelAdminHandlers.openDeleteConfirm(channelContextMenu.channel);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 10px',
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: 'var(--danger)',
          cursor: 'pointer',
          fontSize: 12,
          textAlign: 'left',
          transition: 'all 0.1s',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)'; }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
        Delete
      </button>
    </div>
  );
}

export function VoiceParticipantVolumeMenu({
  volumeMenu = null,
  mutedUsers = {},
  menuRef = null,
  channelInteractionHandlers,
} = {}) {
  if (!volumeMenu) {
    return null;
  }

  const menuState = buildVoiceVolumeMenuState(volumeMenu, {
    mutedUsers,
    getUserVolume: (userId) => channelInteractionHandlers.getUserVolume(userId),
  });

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: volumeMenu.y,
        left: volumeMenu.x,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-strong)',
        borderRadius: 8,
        padding: '10px 14px',
        zIndex: 2000,
        minWidth: 200,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        animation: 'fadeIn 0.1s ease-out',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
        }}>
          {volumeMenu.username}
        </span>
        <button
          onClick={() => channelInteractionHandlers.closeVolumeMenu()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            event.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'none';
            event.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
        <input
          type="range"
          min="0"
          max="100"
          value={menuState.displayVolume}
          onChange={(event) => {
            channelInteractionHandlers.handleVolumeMenuChange(volumeMenu.userId, event.target.value);
          }}
          style={{
            flex: 1,
            height: 4,
            accentColor: 'var(--accent)',
            cursor: 'pointer',
          }}
        />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          minWidth: 28,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {menuState.displayVolume}%
        </span>
      </div>
      <button
        onClick={() => channelInteractionHandlers.toggleUserMute(volumeMenu.userId)}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '6px 0',
          background: menuState.isMuted ? 'rgba(255, 71, 87, 0.15)' : 'var(--bg-hover)',
          border: '1px solid',
          borderColor: menuState.isMuted ? 'rgba(255, 71, 87, 0.3)' : 'var(--border)',
          borderRadius: 6,
          color: menuState.isMuted ? 'var(--danger)' : 'var(--text-secondary)',
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          transition: 'all 0.15s',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = menuState.isMuted ? 'rgba(255, 71, 87, 0.25)' : 'rgba(255, 255, 255, 0.08)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = menuState.isMuted ? 'rgba(255, 71, 87, 0.15)' : 'var(--bg-hover)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {menuState.isMuted ? (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </>
          ) : (
            <>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </>
          )}
        </svg>
        {menuState.toggleLabel}
      </button>
    </div>
  );
}
