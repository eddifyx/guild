import { memo, useState, useEffect, useRef } from 'react';
import Avatar from '../Common/Avatar';
import OnlineBadge from '../Common/OnlineBadge';

function DMList({ conversations, activeId, onSelect, onRemove, onlineIds, unreadCounts }) {
  const [contextMenu, setContextMenu] = useState(null);
  const menuRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  if (!conversations.length) {
    return (
      <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
        No conversations yet
      </div>
    );
  }

  return (
    <div>
      {conversations.map(conv => {
        const isActive = activeId === conv.other_user_id;
        return (
          <button
            key={conv.other_user_id}
            onClick={() => onSelect(conv)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, conv });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              border: 'none',
              borderRadius: 6,
              background: isActive ? 'var(--bg-active)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              transition: 'all 0.15s',
              fontWeight: isActive ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <div style={{ position: 'relative' }}>
              <Avatar username={conv.other_username} color={conv.other_avatar_color} size={24} />
              <OnlineBadge online={onlineIds.has(conv.other_user_id)} size={7} />
            </div>
            <span className="truncate" style={{ flex: 1 }}>{conv.other_username}</span>
            {unreadCounts?.[conv.other_user_id] > 0 && (
              <span style={{
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: 'var(--danger)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 5px',
                flexShrink: 0,
              }}>
                {unreadCounts[conv.other_user_id] > 99 ? '99+' : unreadCounts[conv.other_user_id]}
              </span>
            )}
          </button>
        );
      })}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            padding: '10px 14px',
            zIndex: 2000,
            minWidth: 180,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            animation: 'fadeIn 0.1s ease-out',
          }}
          onClick={e => e.stopPropagation()}
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
              {contextMenu.conv.other_username}
            </span>
            <button
              onClick={() => setContextMenu(null)}
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
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => {
              onRemove(contextMenu.conv.other_user_id);
              setContextMenu(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 10px',
              border: '1px solid rgba(255, 71, 87, 0.3)',
              borderRadius: 6,
              background: 'rgba(255, 71, 87, 0.1)',
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 71, 87, 0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Remove Conversation
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(DMList);
