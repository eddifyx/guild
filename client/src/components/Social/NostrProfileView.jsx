import { useState, useEffect, useCallback } from 'react';
import { fetchCurrentProfile } from '../../nostr/profilePublisher';
import { getUserPubkey } from '../../utils/nostrConnect';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useSocket } from '../../contexts/SocketContext';
import { useGuilds } from '../../hooks/useGuilds';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { getFileUrl } from '../../api';
import { nip19 } from 'nostr-tools';
import Avatar from '../Common/Avatar';
import GuildSettingsModal from '../Guild/GuildSettingsModal';
import ProfileSettingsModal from '../Profile/ProfileSettingsModal';
import { startPerfTrace } from '../../utils/devPerf';

export default function NostrProfileView() {
  const { user, logout } = useAuth();
  const { currentGuild, currentGuildData, clearGuild } = useGuild();
  const { socket } = useSocket();
  const { leaveGuild } = useGuilds();
  const { onlineUsers } = useOnlineUsers();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Status editing
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');

  // Guild settings modal
  const [showGuildSettings, setShowGuildSettings] = useState(false);
  const [guildSettingsOpenTraceId, setGuildSettingsOpenTraceId] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const closeGuildSettings = useCallback(() => {
    setShowGuildSettings(false);
    setGuildSettingsOpenTraceId(null);
  }, []);
  const openGuildSettings = useCallback(() => {
    setGuildSettingsOpenTraceId(startPerfTrace('guild-settings-open', {
      surface: 'nostr-profile',
    }));
    setShowGuildSettings(true);
  }, []);

  // Confirm dialog
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [flashMsg, setFlashMsg] = useState(null);

  const npub = user?.npub || '';

  // Get hex pubkey for relay queries
  const getPk = () => {
    let pk = getUserPubkey();
    if (!pk) {
      try { if (user?.npub) pk = nip19.decode(user.npub).data; } catch {}
    }
    return pk;
  };

  const loadProfile = useCallback(async () => {
    const pk = getPk();
    if (!pk) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const prof = await fetchCurrentProfile(pk);
      setProfile(prof);
    } catch {
      // Ignore relay errors here; the page can still render from local auth state.
    } finally {
      setLoading(false);
    }
  }, [user?.npub]);

  // Fetch Nostr profile on mount (read-only)
  useEffect(() => {
    loadProfile().catch(() => {});
  }, [loadProfile]);

  // Derive current status from online users
  const me = onlineUsers.find(u => u.userId === user?.userId);
  const myStatus = me?.customStatus || '';

  const handleCopyNpub = () => {
    navigator.clipboard.writeText(npub).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStatusSave = () => {
    const text = statusDraft.trim().slice(0, 128);
    if (socket) socket.emit('status:update', { status: text });
    setEditingStatus(false);
  };

  const handleStartEditStatus = () => {
    setStatusDraft(myStatus);
    setEditingStatus(true);
  };

  const handleLeaveGuild = () => {
    setConfirmDialog({
      title: 'Leave Guild',
      message: `Leave ${currentGuildData?.name || 'this guild'}? You'll need to join or create a new guild.`,
      danger: false,
      confirmLabel: 'Leave',
      onConfirm: async () => {
        try {
          await leaveGuild(currentGuild);
          clearGuild();
        } catch (err) {
          setFlashMsg(err.message || 'Failed to leave guild');
          setTimeout(() => setFlashMsg(null), 4000);
        }
      },
    });
  };

  const handleLogout = () => {
    setConfirmDialog({
      title: 'Log Out',
      message: 'Are you sure you want to log out?',
      danger: false,
      confirmLabel: 'Log Out',
      onConfirm: () => logout(),
    });
  };

  const displayName = profile
    ? (profile.name || profile.display_name || user?.username || 'Anonymous')
    : (user?.username || 'Anonymous');
  const picture = profile ? (profile.picture || '') : (user?.profilePicture || '');
  const about = profile ? (profile.about || '') : '';

  return (
    <>
      <div style={styles.container}>
        <div style={styles.scrollArea}>
          <div style={styles.column}>

            {/* Profile Card */}
            <div style={styles.card}>
              <div style={styles.profileRow}>
                {picture ? (
                  <img src={picture} alt="" style={styles.profilePic} />
                ) : (
                  <Avatar username={displayName} color={user?.avatarColor || '#40FF40'} size={64} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.displayName}>{displayName}</div>
                  <button onClick={handleCopyNpub} style={styles.npubBtn} title="Copy npub">
                    <span style={styles.npubText}>
                      {npub.slice(0, 20)}...{npub.slice(-6)}
                    </span>
                    {copied ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {loading ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>Loading profile...</div>
              ) : about ? (
                <p style={styles.aboutText}>{about}</p>
              ) : null}

              <div style={styles.profileActions}>
                <button
                  onClick={() => setShowProfileEditor(true)}
                  style={styles.editProfileBtn}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Edit Profile
                </button>
                <button
                  onClick={() => window.electronAPI?.openExternal(`https://primal.net/p/${npub}`)}
                  style={styles.primalBtn}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View on Primal
                </button>
              </div>
            </div>

            {/* Guild Info Card */}
            {currentGuildData && (
              <div style={styles.card}>
                <div style={styles.sectionLabel}>GUILD</div>
                <div style={styles.guildRow}>
                  {currentGuildData.image_url ? (
                    <img src={getFileUrl(currentGuildData.image_url)} alt="" style={styles.guildIcon} />
                  ) : (
                    <div style={styles.guildIconFallback}>
                      {currentGuildData.name?.[0]?.toUpperCase() || 'G'}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {currentGuildData.name || 'Guild'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {currentGuildData.member_count || '—'} members
                    </div>
                  </div>
                </div>

                {/* Custom Status */}
                <div style={{ marginTop: 16 }}>
                  <div style={styles.sectionLabel}>STATUS</div>
                  {editingStatus ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={statusDraft}
                        onChange={e => setStatusDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleStatusSave(); if (e.key === 'Escape') setEditingStatus(false); }}
                        maxLength={128}
                        placeholder="What are you up to?"
                        autoFocus
                        style={styles.statusInput}
                      />
                      <button onClick={handleStatusSave} style={styles.statusSaveBtn}>Save</button>
                    </div>
                  ) : (
                    <button onClick={handleStartEditStatus} style={styles.statusDisplay}>
                      {myStatus || 'Set a status...'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Settings Card */}
            <div style={styles.card}>
              <div style={styles.sectionLabel}>SETTINGS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {currentGuild && (
                  <button
                    onClick={openGuildSettings}
                    style={styles.settingsBtn}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Guild Settings
                  </button>
                )}

                {currentGuild && (
                  <button
                    onClick={handleLeaveGuild}
                    style={styles.leaveGuildBtn}
                    onMouseEnter={e => { e.currentTarget.style.background = '#991b1b'; e.currentTarget.style.borderColor = '#f87171'; e.currentTarget.style.color = '#fee2e2'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.24), 0 0 14px rgba(239, 68, 68, 0.22)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(127, 29, 29, 0.92)'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#fecaca'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.04)'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                      <polyline points="16,17 21,12 16,7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Leave Guild
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  style={{ ...styles.settingsBtn, color: 'var(--danger)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16,17 21,12 16,7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Log Out
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {flashMsg && (
        <div style={styles.flashMsg}>{flashMsg}</div>
      )}

      {showGuildSettings && (
        <GuildSettingsModal onClose={closeGuildSettings} openTraceId={guildSettingsOpenTraceId} />
      )}

      {showProfileEditor && (
        <ProfileSettingsModal
          onClose={() => setShowProfileEditor(false)}
          onSaved={(nextProfile) => {
            setProfile(nextProfile);
            setShowProfileEditor(false);
          }}
        />
      )}

      {/* Confirm dialog */}
      {confirmDialog && (
        <div style={styles.confirmOverlay} onClick={() => setConfirmDialog(null)}>
          <div style={styles.confirmModal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.confirmTitle}>{confirmDialog.title}</h3>
            <p style={styles.confirmMessage}>{confirmDialog.message}</p>
            <div style={styles.confirmActions}>
              <button onClick={() => setConfirmDialog(null)} style={styles.confirmCancelBtn}>Cancel</button>
              <button
                onClick={() => { const cb = confirmDialog.onConfirm; setConfirmDialog(null); cb(); }}
                style={confirmDialog.danger ? styles.confirmDangerBtn : styles.confirmAcceptBtn}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    justifyContent: 'center',
    padding: '24px 16px',
  },
  column: {
    width: '100%',
    maxWidth: 480,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    padding: 20,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  profileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 12,
  },
  profilePic: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid var(--border)',
    flexShrink: 0,
  },
  displayName: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  npubBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  npubText: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
  },
  aboutText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: '0 0 12px',
    lineHeight: 1.6,
    wordBreak: 'break-word',
  },
  profileActions: {
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  editProfileBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  primalBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: 10,
  },
  guildRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  guildIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    objectFit: 'cover',
    flexShrink: 0,
  },
  guildIconFallback: {
    width: 40,
    height: 40,
    borderRadius: 10,
    flexShrink: 0,
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  statusInput: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input, var(--bg-primary))',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  statusSaveBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusDisplay: {
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  settingsBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background 0.15s',
    textAlign: 'left',
  },
  leaveGuildBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #ef4444',
    background: 'rgba(127, 29, 29, 0.92)',
    color: '#fecaca',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
    textAlign: 'left',
    boxShadow: '0 0 0 1px rgba(239, 68, 68, 0.16), inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  // Confirm dialog styles
  confirmOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  confirmModal: {
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.95), rgba(21, 26, 21, 0.9))',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '28px 32px',
    width: 380,
    maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 8px',
  },
  confirmMessage: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    margin: '0 0 24px',
    lineHeight: 1.5,
  },
  confirmActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
  },
  confirmCancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    padding: '8px 20px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
  },
  confirmAcceptBtn: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    padding: '8px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  confirmDangerBtn: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    padding: '8px 24px',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  },
  flashMsg: {
    position: 'fixed',
    top: 40,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--danger)',
    border: '1px solid var(--danger)',
    padding: '10px 24px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    zIndex: 1200,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
};
