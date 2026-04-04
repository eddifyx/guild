import React from 'react';
import Avatar from '../Common/Avatar';
import { buildSidebarOnlineUsersState } from '../../features/layout/sidebarPanelsModel.mjs';
import { SidebarSectionHeader } from './SidebarShared.jsx';

export default function SidebarOnlineUsersSection({
  onlineUsers = [],
  currentUserId = null,
  onOpenProfile = () => {},
}) {
  const onlineState = buildSidebarOnlineUsersState({
    onlineUsers,
    currentUserId,
  });

  return (
    <div>
      <SidebarSectionHeader label={onlineState.label} />
      <div style={{ padding: '0 4px' }}>
        {onlineState.rows.map((onlineUser) => (
          <div
            key={onlineUser.userId}
            onClick={(event) => {
              if (onlineUser.isCurrentUser) return;
              onOpenProfile(onlineUser, event);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              borderRadius: 6,
              fontSize: 13,
              cursor: onlineUser.isCurrentUser ? 'default' : 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(event) => {
              if (!onlineUser.isCurrentUser) event.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            }}
            onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar username={onlineUser.username} color={onlineUser.avatarColor} size={22} profilePicture={onlineUser.profilePicture} />
              <div style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: 'var(--success)',
                border: '1.5px solid var(--bg-secondary)',
              }} />
            </div>
            <span className="truncate" style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 400 }}>
              {onlineUser.username}
            </span>
          </div>
        ))}
        {onlineState.isEmpty && (
          <div style={{ padding: '8px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
            No one online
          </div>
        )}
      </div>
    </div>
  );
}
