import React from 'react';
import Avatar from '../Common/Avatar';
import { buildSidebarUserBarState } from '../../features/layout/sidebarPanelsModel.mjs';

export default function SidebarUserBar({
  user,
  connected = false,
  notificationsMuted = false,
  onOpenProfile = () => {},
  onToggleNotificationsMuted = () => {},
  onLogout = () => {},
} = {}) {
  const userBarState = buildSidebarUserBarState({
    user,
    connected,
    notificationsMuted,
  });

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <button
        type="button"
        onClick={onOpenProfile}
        title="Open profile"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <Avatar username={userBarState.username} color={userBarState.avatarColor} size={28} profilePicture={userBarState.profilePicture} />
        </div>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="truncate" style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>
            {userBarState.username}
          </div>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: userBarState.indicatorBackground,
            boxShadow: userBarState.indicatorShadow,
            flexShrink: 0,
          }} />
        </div>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onToggleNotificationsMuted}
          title={userBarState.notificationButtonTitle}
          aria-pressed={userBarState.notificationsMuted}
          style={{
            background: userBarState.notificationButtonBackground,
            border: userBarState.notificationButtonBorder,
            color: userBarState.notificationButtonColor,
            cursor: 'pointer',
            padding: 0,
            width: 28,
            height: 28,
            minWidth: 28,
            minHeight: 28,
            boxSizing: 'border-box',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitAppRegion: 'no-drag',
            borderRadius: 6,
            transition: 'color 0.15s, border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={(event) => { event.currentTarget.style.color = userBarState.notificationButtonHoverColor; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = userBarState.notificationButtonColor; }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 17H5l1.4-1.4c.4-.4.6-.9.6-1.4V11a5 5 0 0 1 10 0v3.2c0 .5.2 1 .6 1.4L19 17h-4" />
            <path d="M9 17a3 3 0 0 0 6 0" />
            <path d="M3.5 3.5 20.5 20.5" opacity={userBarState.notificationsMuted ? 1 : 0} />
          </svg>
        </button>
        <button
          onClick={onLogout}
          title="Log out"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
            width: 28,
            height: 28,
            minWidth: 28,
            minHeight: 28,
            boxSizing: 'border-box',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitAppRegion: 'no-drag',
            borderRadius: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
