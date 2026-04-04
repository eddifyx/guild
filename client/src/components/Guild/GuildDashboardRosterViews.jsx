import React, { useEffect, useRef, useState } from 'react';

import Avatar from '../Common/Avatar';

function MemberRow({
  member,
  formatLastSeen = () => '',
  onClickMember,
  onOpenStatus,
  canOpenProfile = false,
  styles = {},
} = {}) {
  const isOnline = member.isOnline;
  const fullStatus = member.customStatus?.trim() || '';
  const hasStatus = Boolean(fullStatus);

  return (
    <div
      style={{
        ...styles.memberRow,
        opacity: isOnline ? 1 : 0.45,
        cursor: canOpenProfile ? 'pointer' : 'default',
      }}
      onClick={(event) => {
        if (canOpenProfile) onClickMember?.(member, event);
      }}
      onMouseEnter={(event) => {
        if (canOpenProfile) event.currentTarget.style.background = 'rgba(64, 255, 64, 0.03)';
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={styles.memberAvatarWrap}>
        <Avatar username={member.username} color={member.avatarColor} size={26} profilePicture={member.profilePicture} />
        {isOnline && <div style={styles.onlineDot} />}
      </div>

      <span style={styles.memberName}>{member.username}</span>
      <span style={styles.rankBadge}>{member.rankName || 'Member'}</span>

      <div style={styles.memberStatusCell}>
        {hasStatus ? (
          <button
            type="button"
            style={styles.memberStatusButton}
            title={`View full status for ${member.username}`}
            aria-label={`View full status for ${member.username}`}
            onMouseDown={(event) => { event.preventDefault(); }}
            onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-secondary)'; }}
            onClick={(event) => {
              event.stopPropagation();
              onOpenStatus?.(member, event);
            }}
          >
            <span style={styles.memberStatusText}>{fullStatus}</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.memberStatusIcon}>
              <path d="M15 3h6v6" />
              <path d="M10 14 21 3" />
              <path d="M21 14v7H3V3h7" />
            </svg>
          </button>
        ) : (
          <span style={styles.memberStatusPlaceholder}>-</span>
        )}
      </div>

      <span
        style={{
          ...styles.memberLastSeenCell,
          color: isOnline ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        {isOnline ? 'Online now' : formatLastSeen(member.lastSeen)}
      </span>

      <span style={styles.memberLinkCell}>
        {member.npub && (
          <span
            style={styles.profileLink}
            onClick={(event) => {
              event.stopPropagation();
              window.electronAPI?.openExternal(`https://primal.net/p/${member.npub}`);
            }}
          >
            Primal
          </span>
        )}
      </span>
    </div>
  );
}

export function StatusPopover({ username, status, position, onClose, styles = {} }) {
  const popoverRef = useRef(null);
  const [popoverStyle, setPopoverStyle] = useState({});

  useEffect(() => {
    if (!popoverRef.current || !position) return;
    const rect = popoverRef.current.getBoundingClientRect();
    const pad = 12;
    let left = position.x;
    let top = position.y + 8;

    if (left + rect.width + pad > window.innerWidth) {
      left = window.innerWidth - rect.width - pad;
    }
    if (top + rect.height + pad > window.innerHeight) {
      top = position.top - rect.height - 8;
    }
    if (top < pad) top = pad;
    if (left < pad) left = pad;

    setPopoverStyle({ left, top });
  }, [position]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => window.addEventListener('mousedown', handlePointerDown), 0);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div ref={popoverRef} style={{ ...styles.statusPopover, ...popoverStyle }}>
      <div style={styles.statusPopoverHeader}>
        <div style={styles.statusPopoverUser}>{username}</div>
        <button
          type="button"
          style={styles.statusPopoverClose}
          onMouseDown={(event) => { event.preventDefault(); }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div style={styles.statusPopoverText}>{status}</div>
      <div style={styles.statusPopoverHint}>Press Esc or click outside to close.</div>
    </div>
  );
}

export function GuildDashboardRosterSection({
  visibleMembers = [],
  memberPool = [],
  onlineCount = 0,
  totalMemberCount = 0,
  showOffline = false,
  isRosterExpanded = false,
  hasMore = false,
  currentUserId = null,
  formatLastSeen = () => '',
  onToggleExpanded = () => {},
  onToggleShowOffline = () => {},
  onShowMore = () => {},
  onOpenStatus = () => {},
  onOpenProfile = () => {},
  styles = {},
} = {}) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <div style={styles.sectionLabelWrap}>
          <div style={styles.sectionLabel}>
            Members &mdash; {onlineCount} Online{showOffline ? ` / ${totalMemberCount} Total` : ''}
          </div>
          <button
            type="button"
            onClick={onToggleExpanded}
            title={isRosterExpanded ? 'Collapse roster' : 'Expand roster'}
            style={styles.memberExpandIconBtn}
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
            {isRosterExpanded ? (
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
        </div>

        <div style={styles.memberControls}>
          <label style={styles.memberToggle}>
            <input
              type="checkbox"
              checked={showOffline}
              onChange={(event) => onToggleShowOffline(event.target.checked)}
              style={styles.memberToggleInput}
            />
            <span>Show offline</span>
          </label>
        </div>
      </div>

      <div style={styles.membersList}>
        <div style={styles.memberListHeader}>
          <span style={styles.colAvatar} />
          <span style={styles.colName}>Name</span>
          <span style={styles.colRank}>Rank</span>
          <span style={styles.colStatus}>Status</span>
          <span style={styles.colLastSeen}>Last Seen</span>
          <span style={styles.colLink}>Profile</span>
        </div>

        {visibleMembers.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            formatLastSeen={formatLastSeen}
            canOpenProfile={member.id !== currentUserId}
            onOpenStatus={onOpenStatus}
            onClickMember={onOpenProfile}
            styles={styles}
          />
        ))}
      </div>

      {hasMore && !isRosterExpanded && (
        <button
          onClick={onShowMore}
          style={styles.showMoreBtn}
          onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.2)'; }}
          onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          Show {memberPool.length} member{memberPool.length !== 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}
