import React from 'react';
export function ConversationHeaderIcon({ kind }) {
  if (kind === 'home') {
    return (
      <span style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: '#40FF40',
        boxShadow: '0 0 10px rgba(64, 255, 64, 0.4)',
        flexShrink: 0,
      }} />
    );
  }

  if (kind === 'room') {
    return <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>#</span>;
  }

  if (kind === 'dm') {
    return (
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'var(--status-color)',
        boxShadow: 'var(--status-shadow)',
      }} />
    );
  }

  if (kind === 'assets') {
    return (
      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8v13H3V3h12l6 5z" />
          <path d="M14 3v6h6" />
        </svg>
      </span>
    );
  }

  if (kind === 'addons') {
    return (
      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </span>
    );
  }

  if (kind === 'nostr-profile') {
    return (
      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </span>
    );
  }

  if (kind === 'stream') {
    return (
      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </span>
    );
  }

  if (kind === 'voice') {
    return (
      <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
      </span>
    );
  }

  return null;
}

export function ConversationHeaderContent({
  headerState = null,
  onRequestVerifyIdentity = () => {},
} = {}) {
  if (!headerState) {
    return null;
  }

  const dmStatusColor = headerState.isOnline ? 'var(--success)' : 'var(--text-muted)';
  const dmStatusShadow = headerState.isOnline ? '0 0 6px rgba(0, 214, 143, 0.4)' : 'none';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 16,
      minWidth: 0,
      '--status-color': dmStatusColor,
      '--status-shadow': dmStatusShadow,
    }}>
      <ConversationHeaderIcon kind={headerState.kind} />
      <span style={{
        fontWeight: headerState.kind === 'home' ? 700 : 600,
        fontSize: 13,
        color: headerState.kind === 'home' ? '#40FF40' : 'var(--text-primary)',
        textShadow: headerState.kind === 'home' ? '0 0 10px rgba(64, 255, 64, 0.16)' : 'none',
      }}>
        {headerState.title}
      </span>
      {headerState.live && (
        <span style={{
          fontSize: 10,
          color: '#40FF40',
          fontWeight: 600,
          padding: '1px 6px',
          background: 'rgba(64, 255, 64, 0.15)',
          borderRadius: 4,
        }}>
          LIVE
        </span>
      )}
      {headerState.subtitle && (
        <span style={{
          fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {headerState.subtitle}
        </span>
      )}
      {headerState.canVerifyIdentity && (
        <button
          onClick={onRequestVerifyIdentity}
          title="Verify identity"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            marginLeft: 4,
            transition: 'color 0.15s',
            WebkitAppRegion: 'no-drag',
          }}
          onMouseEnter={(event) => { event.currentTarget.style.color = '#40FF40'; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </button>
      )}
    </div>
  );
}
