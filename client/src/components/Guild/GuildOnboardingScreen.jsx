import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useGuilds } from '../../hooks/useGuilds';
import { checkLatestVersion, getServerUrl, getFileUrl } from '../../api';
import CreateGuildModal from './CreateGuildModal';
import JoinGuildModal from './JoinGuildModal';
import ProfileSettingsModal from '../Profile/ProfileSettingsModal';
import UpdateOverlay from '../Common/UpdateOverlay';
import Avatar from '../Common/Avatar';

export default function GuildOnboardingScreen() {
  const { user, logout } = useAuth();
  const { fetchMyGuild } = useGuild();
  const { publicGuilds, fetchPublicGuilds, joinGuild } = useGuilds();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [joining, setJoining] = useState(null);
  const [confirmGuild, setConfirmGuild] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersionInfo, setLatestVersionInfo] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  const [showUpdateOverlay, setShowUpdateOverlay] = useState(false);
  const [versionToast, setVersionToast] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchPublicGuilds();
  }, [fetchPublicGuilds]);

  // Fade in after first frame to prevent layout flash
  useEffect(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(v => setAppVersion(v));
    checkLatestVersion().then((info) => {
      setLatestVersionInfo(info);
      if (info?.hasUpdate) setUpdateAvailable(true);
    }).catch(() => {});
  }, []);

  const handleGuildCreated = () => {
    setShowCreate(false);
    fetchMyGuild();
  };

  const handleGuildJoined = () => {
    setShowJoin(false);
    fetchMyGuild();
  };

  const handleDiscoverClick = (guild) => {
    setConfirmGuild(guild);
  };

  const handleConfirmJoin = async () => {
    if (!confirmGuild) return;
    setJoining(confirmGuild.id);
    setConfirmGuild(null);
    try {
      await joinGuild(confirmGuild.id);
      fetchMyGuild();
    } catch (err) {
      console.error('Failed to join guild:', err);
      setJoining(null);
    }
  };

  return (
    <div style={{ ...styles.container, opacity: ready ? 1 : 0 }}>
      {/* Title bar with drag region + window controls */}
      <div style={styles.titleBar}>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '100%', WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => {
              if (updateAvailable) {
                if (latestVersionInfo) {
                  setShowUpdateOverlay(true);
                } else {
                  checkLatestVersion().then((info) => {
                    setLatestVersionInfo(info);
                    if (info?.hasUpdate) {
                      setUpdateAvailable(true);
                      setShowUpdateOverlay(true);
                    }
                  }).catch(() => {});
                }
              } else {
                checkLatestVersion().then((info) => {
                  setLatestVersionInfo(info);
                  if (info?.hasUpdate) {
                    setUpdateAvailable(true);
                    setShowUpdateOverlay(true);
                  } else {
                    setVersionToast(`You're up to date (v${appVersion})`);
                    setTimeout(() => setVersionToast(null), 3000);
                  }
                });
              }
            }}
            title={updateAvailable ? 'Update available — click for details' : `v${appVersion} — Check for updates`}
            style={{
              background: updateAvailable ? 'rgba(0, 214, 143, 0.15)' : 'none',
              border: 'none',
              color: updateAvailable ? 'var(--success)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0 12px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'color 0.15s, background 0.15s',
              animation: updateAvailable ? 'pulse-glow-green 2s ease-in-out infinite' : 'none',
              fontSize: 10,
            }}
            onMouseEnter={e => {
              if (updateAvailable) {
                e.currentTarget.style.background = 'rgba(0, 214, 143, 0.25)';
              } else {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }
            }}
            onMouseLeave={e => {
              if (updateAvailable) {
                e.currentTarget.style.background = 'rgba(0, 214, 143, 0.15)';
              } else {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'none';
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          {/* Minimize */}
          <button
            onClick={() => window.electronAPI?.windowMinimize?.()}
            style={styles.winBtn}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          {/* Maximize */}
          <button
            onClick={() => window.electronAPI?.windowMaximize?.()}
            style={styles.winBtn}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </button>
          {/* Close */}
          <button
            onClick={() => window.electronAPI?.windowClose?.()}
            style={styles.winBtn}
            onMouseEnter={e => { e.currentTarget.style.background = '#e81123'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
              <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Version toast */}
      {versionToast && (
        <div
          onClick={() => setVersionToast(null)}
          style={{
            position: 'fixed', top: 48, left: '50%', transform: 'translateX(-50%)',
            zIndex: 9998, background: 'var(--bg-tertiary)', border: '1px solid var(--accent)',
            borderRadius: 8, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{versionToast}</span>
        </div>
      )}

      {showUpdateOverlay && (
        <UpdateOverlay
          serverUrl={getServerUrl()}
          onDismiss={() => setShowUpdateOverlay(false)}
          updateInfo={latestVersionInfo}
        />
      )}

      {/* Background ambient glow */}
      <div style={styles.ambientGlow} />
      <div style={styles.ambientGlow2} />

      <div style={styles.inner}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.brandMark}>/guild</h1>
            <span style={styles.subtitle}>Choose your path</span>
          </div>
          <div style={styles.headerRight}>
            <div onClick={() => setShowProfile(true)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }} title="Edit Nostr profile">
              <Avatar username={user?.username || '?'} color={user?.avatarColor || '#40FF40'} size={28} profilePicture={user?.profilePicture} />
              <span style={styles.username}>{user?.username}</span>
            </div>
            <button onClick={logout} style={styles.logoutBtn}>Logout</button>
          </div>
        </div>

        <div style={styles.actions}>
          <button
            onClick={() => setShowCreate(true)}
            style={styles.formGuildBtn}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(64, 255, 64, 0.3)';
              e.currentTarget.style.background = '#33cc33';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = '#40FF40';
            }}
          >
            + Form Guild
          </button>
          <button
            onClick={() => setShowJoin(true)}
            style={styles.joinBtn}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.3)';
              e.currentTarget.style.background = 'rgba(64, 255, 64, 0.06)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.background = 'var(--bg-tertiary)';
            }}
          >
            Join Guild
          </button>
        </div>

        {/* Discover public guilds */}
        {publicGuilds.length > 0 && (
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>Discover</h2>
            <div style={styles.grid}>
              {publicGuilds.map(guild => (
                <button
                  key={guild.id}
                  onClick={() => handleDiscoverClick(guild)}
                  disabled={joining === guild.id}
                  style={styles.card}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.35)';
                    e.currentTarget.style.boxShadow = '0 0 24px rgba(64, 255, 64, 0.12), inset 0 1px 0 rgba(64, 255, 64, 0.06)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(14, 17, 14, 0.95), rgba(21, 26, 21, 0.95))';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(14, 17, 14, 0.8), rgba(21, 26, 21, 0.6))';
                  }}
                >
                  <div style={styles.cardIcon}>
                    {guild.image_url ? (
                      <img src={getFileUrl(guild.image_url)} alt="" style={styles.cardImage} />
                    ) : (
                      <span style={styles.cardInitial}>{guild.name[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={styles.cardInfo}>
                    <span style={styles.cardName}>{guild.name}</span>
                    <span style={styles.cardMeta}>
                      {guild.memberCount} member{guild.memberCount !== 1 ? 's' : ''} · Public
                    </span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.5 }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </section>
        )}

        {publicGuilds.length === 0 && (
          <div style={styles.empty}>
            <p style={styles.emptyText}>No guilds yet. Form your own or join one!</p>
          </div>
        )}
      </div>


      {showCreate && (
        <CreateGuildModal
          onClose={() => setShowCreate(false)}
          onCreated={handleGuildCreated}
        />
      )}

      {showJoin && (
        <JoinGuildModal
          onClose={() => setShowJoin(false)}
          onJoined={handleGuildJoined}
        />
      )}

      {showProfile && (
        <ProfileSettingsModal onClose={() => setShowProfile(false)} />
      )}

      {/* Join confirmation dialog */}
      {confirmGuild && (
        <div style={styles.confirmOverlay} onClick={() => setConfirmGuild(null)}>
          <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <div style={styles.confirmIcon}>
              {confirmGuild.image_url ? (
                <img src={getFileUrl(confirmGuild.image_url)} alt="" style={styles.cardImage} />
              ) : (
                <span style={styles.confirmInitial}>{confirmGuild.name[0]?.toUpperCase()}</span>
              )}
            </div>
            <h3 style={styles.confirmTitle}>Join {confirmGuild.name}?</h3>
            <p style={styles.confirmDesc}>
              {confirmGuild.memberCount} member{confirmGuild.memberCount !== 1 ? 's' : ''} · Public guild
            </p>
            <div style={styles.confirmActions}>
              <button
                onClick={() => setConfirmGuild(null)}
                style={styles.confirmCancelBtn}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmJoin}
                style={styles.confirmJoinBtn}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(64, 255, 64, 0.3)';
                  e.currentTarget.style.background = '#33cc33';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#40FF40';
                }}
              >
                Join Guild
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    background: '#050705',
    color: 'var(--text-primary)',
    fontFamily: "'Geist', sans-serif",
    position: 'relative',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
    transition: 'opacity 0.15s ease',
  },
  titleBar: {
    height: 42,
    minHeight: 42,
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(5, 7, 5, 0.95)',
    borderBottom: '1px solid var(--border)',
    WebkitAppRegion: 'drag',
  },
  winBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0 14px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.15s',
  },
  ambientGlow: {
    position: 'fixed',
    top: '-20%',
    left: '-10%',
    width: '50%',
    height: '60%',
    background: 'radial-gradient(ellipse, rgba(64, 255, 64, 0.04) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  ambientGlow2: {
    position: 'fixed',
    bottom: '-30%',
    right: '-15%',
    width: '60%',
    height: '60%',
    background: 'radial-gradient(ellipse, rgba(64, 255, 64, 0.025) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    flex: 1,
    padding: '48px 40px',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 14,
  },
  brandMark: {
    fontSize: 32,
    fontWeight: 700,
    fontFamily: "'Geist', sans-serif",
    color: '#40FF40',
    textShadow: '0 0 20px rgba(64, 255, 64, 0.4), 0 0 40px rgba(64, 255, 64, 0.15)',
    letterSpacing: '-1px',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  username: {
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(64, 255, 64, 0.1)',
    color: 'var(--text-secondary)',
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontFamily: "'Geist', sans-serif",
    transition: 'border-color 0.2s, color 0.2s',
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginBottom: 40,
  },
  formGuildBtn: {
    background: '#40FF40',
    color: '#050705',
    border: 'none',
    padding: '10px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
    transition: 'background 0.2s, box-shadow 0.2s',
  },
  joinBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    padding: '10px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Geist', sans-serif",
    transition: 'border-color 0.2s, background 0.2s',
  },
  section: {
    marginBottom: 36,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 12,
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 20px',
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.8), rgba(21, 26, 21, 0.6))',
    border: '1px solid var(--border)',
    borderRadius: 10,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s, background 0.2s',
    fontFamily: "'Geist', sans-serif",
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: 'rgba(64, 255, 64, 0.06)',
    border: '1px solid rgba(64, 255, 64, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cardInitial: {
    fontSize: 20,
    fontWeight: 700,
    color: '#40FF40',
    textShadow: '0 0 8px rgba(64, 255, 64, 0.3)',
  },
  cardInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMeta: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  empty: {
    display: 'flex',
    justifyContent: 'center',
    padding: 80,
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: 15,
  },

  // Confirm join dialog
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  confirmModal: {
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.95), rgba(21, 26, 21, 0.95))',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '32px 36px',
    width: 360,
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontFamily: "'Geist', sans-serif",
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(64, 255, 64, 0.04)',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    background: 'rgba(64, 255, 64, 0.06)',
    border: '1px solid rgba(64, 255, 64, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 16,
    boxShadow: '0 0 24px rgba(64, 255, 64, 0.08)',
  },
  confirmInitial: {
    fontSize: 26,
    fontWeight: 700,
    color: '#40FF40',
    textShadow: '0 0 12px rgba(64, 255, 64, 0.3)',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 6px',
    textAlign: 'center',
  },
  confirmDesc: {
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: '0 0 24px',
    textAlign: 'center',
  },
  confirmActions: {
    display: 'flex',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    fontFamily: "'Geist', sans-serif",
    transition: 'border-color 0.2s',
  },
  confirmJoinBtn: {
    flex: 1,
    background: '#40FF40',
    color: '#050705',
    border: 'none',
    padding: '10px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "'Geist', sans-serif",
    transition: 'background 0.2s, box-shadow 0.2s',
  },
};
