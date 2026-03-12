import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function RoomList({ rooms, myRooms, activeId, onSelect, onRename, onDelete, unreadCounts }) {
  const { user } = useAuth();

  const [contextMenu, setContextMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');
  const renameRef = useRef(null);
  const menuRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  // Focus rename input
  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  const handleContextMenu = (e, room) => {
    if (room.created_by !== user.userId) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, room });
  };

  const startRename = (room) => {
    setContextMenu(null);
    setRenaming(room.id);
    setRenameValue(room.name);
    setRenameError('');
  };

  const submitRename = async () => {
    if (!renameValue.trim() || renameValue.trim() === myRooms.find(r => r.id === renaming)?.name) {
      setRenaming(null);
      return;
    }
    try {
      await onRename(renaming, renameValue.trim());
      setRenaming(null);
    } catch (err) {
      setRenameError(err.message);
    }
  };

  const handleDelete = async (room) => {
    setContextMenu(null);
    try {
      await onDelete(room.id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const roomBtn = (room) => {
    const isActive = activeId === room.id;

    if (renaming === room.id) {
      return (
        <div key={room.id} style={{ padding: '2px 6px' }}>
          <input
            ref={renameRef}
            value={renameValue}
            onChange={e => { setRenameValue(e.target.value); setRenameError(''); }}
            onKeyDown={e => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') setRenaming(null);
            }}
            onBlur={submitRename}
            maxLength={50}
            style={{
              width: '100%',
              padding: '6px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {renameError && (
            <div style={{ fontSize: 10, color: 'var(--danger)', padding: '2px 4px' }}>{renameError}</div>
          )}
        </div>
      );
    }

    return (
      <button
        key={room.id}
        onClick={() => onSelect(room)}
        onContextMenu={(e) => handleContextMenu(e, room)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '7px 12px',
          border: 'none',
          borderRadius: 6,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          background: isActive ? 'var(--bg-active)' : 'transparent',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
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
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: isActive ? 'var(--accent)' : 'var(--text-muted)',
          flexShrink: 0,
        }}>
          #
        </span>
        <span className="truncate" style={{ flex: 1 }}>{room.name}</span>
        {unreadCounts?.[room.id] > 0 && !isActive && (
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
            {unreadCounts[room.id] > 99 ? '99+' : unreadCounts[room.id]}
          </span>
        )}
      </button>
    );
  };

  return (
    <div>
      {myRooms.map(room => roomBtn(room))}

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
            borderRadius: 6,
            padding: 4,
            zIndex: 2000,
            minWidth: 140,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            animation: 'fadeIn 0.1s ease-out',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => startRename(contextMenu.room)}
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
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Rename
          </button>
          <button
            onClick={() => handleDelete(contextMenu.room)}
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
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 71, 87, 0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
