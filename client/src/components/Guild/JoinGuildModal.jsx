import { useState, useEffect } from 'react';
import { useGuilds } from '../../hooks/useGuilds';
import { useGuild } from '../../contexts/GuildContext';
import { getFileUrl } from '../../api';

export default function JoinGuildModal({ onClose, onJoined }) {
  const { publicGuilds, fetchPublicGuilds, joinGuild, joinByInviteCode } = useGuilds();
  const { myGuild } = useGuild();
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [tab, setTab] = useState('browse'); // 'browse' | 'invite'

  useEffect(() => {
    fetchPublicGuilds();
  }, [fetchPublicGuilds]);

  // Filter out current guild from browse list
  const available = publicGuilds.filter(g => g.id !== myGuild?.id);

  const handleJoinPublic = async (guildId) => {
    setJoining(true);
    setError('');
    try {
      await joinGuild(guildId);
      onJoined(guildId);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleJoinByCode = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setJoining(true);
    setError('');
    try {
      const result = await joinByInviteCode(inviteCode.trim());
      onJoined(result.guildId);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <h2 style={styles.title}>Join Guild</h2>

        {myGuild && (
          <div style={styles.warning}>
            Joining a new guild will leave <strong style={{ color: 'var(--accent)' }}>{myGuild.name}</strong>
          </div>
        )}

        <div style={styles.tabs}>
          <button
            onClick={() => setTab('browse')}
            style={{ ...styles.tab, ...(tab === 'browse' ? styles.tabActive : {}) }}
          >
            Browse
          </button>
          <button
            onClick={() => setTab('invite')}
            style={{ ...styles.tab, ...(tab === 'invite' ? styles.tabActive : {}) }}
          >
            Invite Code
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {tab === 'browse' && (
          <div style={styles.list}>
            {available.length === 0 ? (
              <p style={styles.empty}>No public guilds available to join</p>
            ) : (
              available.map(guild => (
                <div key={guild.id} style={styles.listItem}>
                  <div style={styles.listIcon}>
                    {guild.image_url ? (
                      <img src={getFileUrl(guild.image_url)} alt="" style={styles.listImage} />
                    ) : (
                      <span style={styles.listInitial}>{guild.name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={styles.listInfo}>
                    <span style={styles.listName}>{guild.name}</span>
                    <span style={styles.listMeta}>
                      {guild.memberCount} member{guild.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => handleJoinPublic(guild.id)}
                    disabled={joining}
                    style={styles.joinBtn}
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'invite' && (
          <form onSubmit={handleJoinByCode} style={styles.inviteForm}>
            <input
              type="text"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              placeholder="Paste invite code..."
              style={styles.input}
              autoFocus
            />
            <button type="submit" disabled={!inviteCode.trim() || joining} style={styles.submitBtn}>
              {joining ? 'Joining...' : 'Join'}
            </button>
          </form>
        )}

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Close</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 32,
    width: 480,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Geist', sans-serif",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 20,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    marginBottom: 20,
    background: 'var(--bg-tertiary)',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    padding: '8px 16px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    borderRadius: 6,
    fontFamily: "'Geist', sans-serif",
  },
  tabActive: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  warning: {
    padding: '12px 16px',
    borderRadius: 8,
    background: 'rgba(64, 255, 64, 0.04)',
    border: '1px solid rgba(64, 255, 64, 0.15)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.4,
    backdropFilter: 'blur(6px)',
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
    marginBottom: 12,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'var(--bg-tertiary)',
    borderRadius: 10,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  listImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  listInitial: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--accent)',
  },
  listInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  listName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  listMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  joinBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '6px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
    flexShrink: 0,
  },
  inviteForm: {
    display: 'flex',
    gap: 12,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: "'Geist', sans-serif",
    outline: 'none',
  },
  submitBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
    flexShrink: 0,
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: "'Geist', sans-serif",
  },
};
