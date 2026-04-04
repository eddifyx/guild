import React from 'react';
import Avatar from '../Common/Avatar';
import { styles } from './FollowingModalStyles.mjs';

function FollowingModalFriendProfileCard({
  row,
  copied,
  onCopyNpub,
  onOpenPrimal,
  onRemoveFriend,
}) {
  return (
    <div style={styles.profileCard}>
      <div style={styles.profileHeader}>
        <Avatar username={row.name || row.npub.slice(0, 8)} size={52} profilePicture={row.picture} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.profileName}>{row.name || 'Unknown'}</div>
          <div style={styles.profileMonospaceText}>{row.cardNpubLabel}</div>
        </div>
      </div>
      <div style={styles.profileActions}>
        <button
          onClick={() => onCopyNpub(row.npub)}
          style={styles.cardBtn}
          onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--text-muted)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              Copy npub
            </>
          )}
        </button>
        <button
          onClick={() => onOpenPrimal(row.npub)}
          style={styles.cardBtn}
          onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--text-muted)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
          View on Primal
        </button>
        <button
          onClick={() => onRemoveFriend(row.npub)}
          style={{ ...styles.cardBtn, color: 'var(--error, #ff4040)' }}
          onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'var(--error, #ff4040)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          Remove
        </button>
      </div>
    </div>
  );
}

export function FollowingModalFriendsPanel({
  loadingFriends,
  friendRows,
  copied,
  onToggleSelectedFriend,
  onCopyNpub,
  onOpenPrimal,
  onRemoveFriend,
}) {
  if (loadingFriends) {
    return <div style={styles.emptyState}>Loading friends...</div>;
  }

  if (friendRows.length === 0) {
    return <div style={styles.emptyState}>No friends yet — search for someone in the Search tab</div>;
  }

  return friendRows.map((row) => (
    <div key={row.npub}>
      <button
        onClick={() => onToggleSelectedFriend(row.npub)}
        style={{
          ...styles.contactRow,
          background: row.selected ? 'var(--bg-active)' : 'transparent',
        }}
        onMouseEnter={(event) => {
          if (!row.selected) {
            event.currentTarget.style.background = 'var(--bg-hover)';
          }
        }}
        onMouseLeave={(event) => {
          if (!row.selected) {
            event.currentTarget.style.background = 'transparent';
          }
        }}
      >
        <Avatar username={row.name || row.npub.slice(0, 8)} size={36} profilePicture={row.picture} />
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div style={styles.nameText}>{row.displayName}</div>
          <div style={styles.npubText}>{row.rowNpubLabel}</div>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            ...styles.chevron,
            transform: row.selected ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {row.selected ? (
        <FollowingModalFriendProfileCard
          row={row}
          copied={copied}
          onCopyNpub={onCopyNpub}
          onOpenPrimal={onOpenPrimal}
          onRemoveFriend={onRemoveFriend}
        />
      ) : null}
    </div>
  ));
}
