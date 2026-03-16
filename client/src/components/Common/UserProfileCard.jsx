import { useState, useEffect, useRef } from 'react';
import { fetchCurrentProfile } from '../../nostr/profilePublisher';
import { nip19 } from 'nostr-tools';
import Avatar from './Avatar';

export default function UserProfileCard({ userId, username, avatarColor, profilePicture, npub, customStatus, isOnline, onClose, onSendMessage, position }) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(!!npub);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);
  const [cardStyle, setCardStyle] = useState({});

  // Fetch Nostr profile if npub available
  useEffect(() => {
    if (!npub) return;
    let cancelled = false;
    let hexKey;
    try { hexKey = nip19.decode(npub).data; } catch { setLoadingProfile(false); return; }

    fetchCurrentProfile(hexKey).then(prof => {
      if (!cancelled) setProfile(prof);
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoadingProfile(false);
    });
    return () => { cancelled = true; };
  }, [npub]);

  // Position the card within viewport bounds
  useEffect(() => {
    if (!cardRef.current || !position) return;
    const rect = cardRef.current.getBoundingClientRect();
    const pad = 12;
    let left = position.x + 8;
    let top = position.y - 20;

    if (left + rect.width + pad > window.innerWidth) {
      left = position.x - rect.width - 8;
    }
    if (top + rect.height + pad > window.innerHeight) {
      top = window.innerHeight - rect.height - pad;
    }
    if (top < pad) top = pad;
    if (left < pad) left = pad;

    setCardStyle({ left, top });
  }, [position]);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) onClose();
    };
    window.addEventListener('keydown', handleKey);
    // Delay adding click listener so the opening click doesn't immediately close
    const timer = setTimeout(() => window.addEventListener('mousedown', handleClick), 0);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
      clearTimeout(timer);
    };
  }, [onClose]);

  const handleCopyNpub = () => {
    navigator.clipboard.writeText(npub).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const displayName = profile?.name || profile?.display_name || username;
  const picture = profile?.picture || profilePicture || '';
  const about = profile?.about || '';

  return (
    <div ref={cardRef} style={{ ...styles.card, ...cardStyle }}>
      {/* Header row: avatar + name */}
      <div style={styles.header}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {picture ? (
            <img src={picture} alt="" style={styles.avatar} />
          ) : (
            <Avatar username={username} color={avatarColor || '#40FF40'} size={48} />
          )}
          <div style={{ ...styles.onlineDot, background: isOnline ? 'var(--success)' : 'var(--text-muted)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.displayName}>{displayName}</div>
          {customStatus && (
            <div style={styles.statusText}>{customStatus}</div>
          )}
        </div>
      </div>

      {/* npub */}
      {npub && (
        <button onClick={handleCopyNpub} style={styles.npubBtn} title="Copy npub">
          <span style={styles.npubText}>
            {npub.slice(0, 18)}...{npub.slice(-6)}
          </span>
          {copied ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      )}

      {/* Nostr bio */}
      {loadingProfile ? (
        <div style={styles.bioLoading}>Loading profile...</div>
      ) : about ? (
        <p style={styles.bio}>{about}</p>
      ) : null}

      {/* Divider */}
      <div style={styles.divider} />

      {/* Action buttons */}
      <div style={styles.actions}>
        <button
          onClick={() => { onSendMessage({ userId, username, avatarColor }); onClose(); }}
          style={styles.actionBtn}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(64, 255, 64, 0.12)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Send Message
        </button>
        {npub && (
          <button
            onClick={() => window.electronAPI?.openExternal(`https://primal.net/p/${npub}`)}
            style={styles.secondaryBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View on Primal
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    position: 'fixed',
    zIndex: 1200,
    width: 280,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
    padding: 16,
    animation: 'fadeIn 0.15s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--border)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: '50%',
    border: '2.5px solid var(--bg-secondary)',
  },
  displayName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  statusText: {
    fontSize: 12,
    color: 'var(--text-muted)',
    marginTop: 2,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: 72,
    overflowY: 'auto',
  },
  npubBtn: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    width: '100%',
  },
  npubText: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    flex: 1,
  },
  bioLoading: {
    fontSize: 11,
    color: 'var(--text-muted)',
    padding: '4px 0',
  },
  bio: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    margin: '6px 0 0',
    lineHeight: 1.5,
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    margin: '12px 0',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'rgba(64, 255, 64, 0.12)',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  secondaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '7px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
};
