import { useState, useEffect, useRef } from 'react';
import { useGuild } from '../../contexts/GuildContext';
import { useGuilds } from '../../hooks/useGuilds';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useVoiceContext } from '../../contexts/VoiceContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { getFileUrl } from '../../api';
import Avatar from '../Common/Avatar';
import UserProfileCard from '../Common/UserProfileCard';

const MEMBER_LIMIT = 50;

function MemberRow({ member, formatLastSeen, onClickMember }) {
  const isOnline = member.isOnline;
  return (
    <div
      style={{
        ...styles.memberRow,
        opacity: isOnline ? 1 : 0.45,
        cursor: 'pointer',
      }}
      onClick={(e) => onClickMember?.(member, e)}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(64, 255, 64, 0.03)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Avatar + online indicator */}
      <div style={styles.memberAvatarWrap}>
        <Avatar username={member.username} color={member.avatarColor} size={32} profilePicture={member.profilePicture} />
        {isOnline && <div style={styles.onlineDot} />}
      </div>

      {/* Name */}
      <span style={styles.memberName}>{member.username}</span>

      {/* Rank */}
      <span style={styles.rankBadge}>{member.rankName || 'Member'}</span>

      {/* Status (custom or last seen) */}
      <span style={styles.memberStatusCell}>
        {isOnline && member.customStatus
          ? member.customStatus
          : isOnline
            ? 'Online'
            : formatLastSeen(member.lastSeen)}
      </span>

      {/* Primal link */}
      <span style={styles.memberLinkCell}>
        {member.npub && (
          <span
            style={styles.profileLink}
            onClick={e => {
              e.stopPropagation();
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

function VoiceActivitySection({ voiceChannels, peers, selfSpeaking, selfChannelId, userId }) {
  function getState(p, chId) {
    const isSelf = p.userId === userId;
    const peerState = peers[p.userId];
    return {
      speaking: isSelf ? (chId === selfChannelId && selfSpeaking) : (peerState?.speaking || false),
      muted: peerState?.muted ?? p.muted ?? false,
      deafened: peerState?.deafened ?? p.deafened ?? false,
    };
  }

  const activeChannels = voiceChannels.filter(ch => ch.participants?.length > 0);
  if (activeChannels.length === 0) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionLabel}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        Voice Activity
      </div>
      <div style={styles.voiceGrid}>
        {activeChannels.map(ch => (
          <div key={ch.id} style={styles.voiceCard}>
            <div style={styles.voiceCardHeader}>
              <span style={styles.voiceChannelName}>{ch.name}</span>
              <span style={styles.voiceParticipantCount}>
                {ch.participants.length} in channel
              </span>
            </div>
            <div style={styles.voiceParticipants}>
              {ch.participants.map(p => {
                const state = getState(p, ch.id);
                return (
                  <div
                    key={p.userId}
                    style={{
                      ...styles.voiceParticipant,
                      color: state.speaking ? '#40FF40' : 'var(--text-secondary)',
                      background: state.speaking ? 'rgba(64, 255, 64, 0.06)' : 'transparent',
                    }}
                  >
                    <div style={{
                      width: 24, height: 24,
                      borderRadius: '50%',
                      border: state.speaking ? '2px solid #40FF40' : '2px solid transparent',
                      boxShadow: state.speaking ? '0 0 8px rgba(64, 255, 64, 0.4)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}>
                      <Avatar username={p.username} color={p.avatarColor} size={18} />
                    </div>
                    <span style={{
                      flex: 1,
                      fontWeight: state.speaking ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {p.username}
                    </span>
                    {p.screenSharing && (
                      <span style={styles.liveBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        LIVE
                      </span>
                    )}
                    {state.muted && !state.deafened && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    )}
                    {state.deafened && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M4 15h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H4V15z" />
                        <path d="M20 15h-2a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h2V15z" />
                        <path d="M20 12V9A8 8 0 0 0 5.09 6.09" />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GuildDashboard({ onSelectDM }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { currentGuild, currentGuildData } = useGuild();
  const { getMotd, fetchMembers } = useGuilds();
  const { voiceChannels, peers, channelId, speaking: selfSpeaking } = useVoiceContext();
  const { onlineUsers, onlineIds } = useOnlineUsers();

  const [motd, setMotd] = useState('');
  const [members, setMembers] = useState([]);
  const [myStatus, setMyStatus] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [editingStatus, setEditingStatus] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [profileCard, setProfileCard] = useState(null);
  const statusInputRef = useRef(null);

  useEffect(() => {
    if (!currentGuild) return;
    getMotd(currentGuild).then(setMotd).catch(() => setMotd(''));
    fetchMembers(currentGuild).then(setMembers).catch(() => setMembers([]));
  }, [currentGuild, getMotd, fetchMembers]);

  useEffect(() => {
    const me = onlineUsers.find(u => u.userId === user?.userId);
    if (me) setMyStatus(me.customStatus || '');
  }, [onlineUsers, user]);

  useEffect(() => {
    if (editingStatus && statusInputRef.current) statusInputRef.current.focus();
  }, [editingStatus]);

  const handleStatusSubmit = () => {
    const text = statusDraft.trim().slice(0, 128);
    if (socket) socket.emit('status:update', { status: text });
    setMyStatus(text);
    setEditingStatus(false);
  };

  const handleStatusKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleStatusSubmit(); }
    if (e.key === 'Escape') setEditingStatus(false);
  };


  const enrichedMembers = members.map(m => {
    const onlineData = onlineUsers.find(u => u.userId === m.id);
    return {
      ...m,
      isOnline: onlineIds.has(m.id),
      customStatus: onlineData?.customStatus || '',
      profilePicture: onlineData?.profilePicture || m.profilePicture || null,
    };
  }).sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (a.rankOrder ?? 999) - (b.rankOrder ?? 999);
  });

  const onlineCount = enrichedMembers.filter(m => m.isOnline).length;
  const voiceParticipantCount = voiceChannels.reduce((sum, ch) => sum + (ch.participants?.length || 0), 0);

  const visibleMembers = showAllMembers ? enrichedMembers : enrichedMembers.slice(0, MEMBER_LIMIT);
  const hasMore = enrichedMembers.length > MEMBER_LIMIT;

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const guildName = currentGuildData?.name || 'Guild';
  const guildImage = currentGuildData?.image_url;
  const [guildImgFailed, setGuildImgFailed] = useState(false);
  const prevGuildImage = useRef(guildImage);
  if (prevGuildImage.current !== guildImage) {
    prevGuildImage.current = guildImage;
    setGuildImgFailed(false);
  }
  const guildDescription = currentGuildData?.description;

  return (
    <div style={styles.container}>
      {/* Ambient background glows */}
      <div style={styles.ambientGlow} />
      <div style={styles.ambientGlow2} />

      <div style={styles.scrollArea}>
        {/* Compact Guild Header + Stats inline */}
        <div style={styles.headerRow}>
          <div style={styles.headerLeft}>
            <div style={styles.heroGuildIcon}>
              {guildImage && !guildImgFailed ? (
                <img src={getFileUrl(guildImage)} alt="" style={styles.heroGuildImg} onError={() => setGuildImgFailed(true)} />
              ) : (
                <span style={styles.heroGuildInitial}>{guildName[0]?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <h1 style={styles.heroGuildName}>{guildName}</h1>
              <div style={styles.heroMeta}>
                <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                <span style={styles.heroDivider}>&middot;</span>
                <div style={styles.heroOnline}>
                  <div style={styles.pulseDot} />
                  <span style={{ color: 'var(--accent)' }}>{onlineCount} online</span>
                </div>
                {voiceParticipantCount > 0 && (
                  <>
                    <span style={styles.heroDivider}>&middot;</span>
                    <span>{voiceParticipantCount} in voice</span>
                  </>
                )}
                {guildDescription && (
                  <>
                    <span style={styles.heroDivider}>&middot;</span>
                    <span
                      style={styles.aboutLink}
                      onClick={() => setShowAbout(true)}
                    >
                      About
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div style={styles.headerRight}>
            {editingStatus ? (
              <input
                ref={statusInputRef}
                value={statusDraft}
                onChange={e => setStatusDraft(e.target.value)}
                onKeyDown={handleStatusKeyDown}
                onBlur={handleStatusSubmit}
                placeholder="What are you up to?"
                maxLength={128}
                style={styles.statusInput}
              />
            ) : (
              <button
                onClick={() => { setStatusDraft(myStatus); setEditingStatus(true); }}
                style={styles.statusDisplay}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                {myStatus || 'Set a status...'}
              </button>
            )}
          </div>
        </div>

        {/* Message of the Day */}
        {motd && (
          <div style={{ ...styles.glassCard, borderLeft: '3px solid var(--accent)', marginBottom: 20 }}>
            <div style={styles.motdLabel}>Message of the Day</div>
            <div style={styles.motdText}>{motd}</div>
          </div>
        )}

        {/* Voice Activity (if anyone in voice) */}
        <VoiceActivitySection
          voiceChannels={voiceChannels}
          peers={peers}
          selfSpeaking={selfSpeaking}
          selfChannelId={channelId}
          userId={user?.userId}
        />

        {/* Members List — THE MAIN CONTENT */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>
            Members &mdash; {onlineCount} Online
          </div>
          <div style={styles.membersList}>
            {/* Column headers */}
            <div style={styles.memberListHeader}>
              <span style={styles.colAvatar} />
              <span style={styles.colName}>Name</span>
              <span style={styles.colRank}>Rank</span>
              <span style={styles.colStatus}>Status</span>
              <span style={styles.colLink}>Profile</span>
            </div>
            {visibleMembers.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                formatLastSeen={formatLastSeen}
                onClickMember={(member, e) => {
                  if (member.id === user?.userId) return;
                  setProfileCard({ user: member, position: { x: e.clientX, y: e.clientY } });
                }}
              />
            ))}
          </div>
          {hasMore && !showAllMembers && (
            <button
              onClick={() => setShowAllMembers(true)}
              style={styles.showMoreBtn}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(64, 255, 64, 0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              Show all {enrichedMembers.length} members
            </button>
          )}
        </div>

      </div>

      {/* User profile card */}
      {profileCard && (
        <UserProfileCard
          userId={profileCard.user.id}
          username={profileCard.user.username}
          avatarColor={profileCard.user.avatarColor}
          profilePicture={profileCard.user.profilePicture}
          npub={profileCard.user.npub}
          customStatus={profileCard.user.customStatus}
          isOnline={profileCard.user.isOnline}
          position={profileCard.position}
          onClose={() => setProfileCard(null)}
          onSendMessage={(u) => {
            if (onSelectDM) onSelectDM({ other_user_id: u.userId, other_username: u.username, other_npub: u.npub || null });
          }}
        />
      )}

      {/* About modal */}
      {showAbout && guildDescription && (
        <div style={styles.aboutOverlay} onClick={() => setShowAbout(false)}>
          <div style={styles.aboutModal} onClick={e => e.stopPropagation()}>
            <div style={styles.aboutHeader}>
              <h3 style={styles.aboutTitle}>About {guildName}</h3>
              <button onClick={() => setShowAbout(false)} style={styles.aboutClose}>&times;</button>
            </div>
            <div style={styles.aboutBody}>{guildDescription}</div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    position: 'relative',
  },

  // Ambient glows
  ambientGlow: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '50%',
    height: '60%',
    background: 'radial-gradient(ellipse, rgba(64, 255, 64, 0.03) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  ambientGlow2: {
    position: 'absolute',
    bottom: '-30%',
    right: '-15%',
    width: '60%',
    height: '60%',
    background: 'radial-gradient(ellipse, rgba(64, 255, 64, 0.02) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },

  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 32px 32px',
    position: 'relative',
    zIndex: 1,
  },

  // Header row
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    padding: '20px 24px',
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.8), rgba(21, 26, 21, 0.6))',
    backdropFilter: 'blur(12px)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    marginBottom: 20,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    minWidth: 0,
  },
  headerRight: {
    flexShrink: 0,
    minWidth: 180,
    maxWidth: 280,
  },
  heroGuildIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: 'rgba(64, 255, 64, 0.06)',
    border: '1px solid rgba(64, 255, 64, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    boxShadow: '0 0 20px rgba(64, 255, 64, 0.08)',
  },
  heroGuildImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  heroGuildInitial: {
    fontSize: 22,
    fontWeight: 700,
    color: '#40FF40',
    textShadow: '0 0 12px rgba(64, 255, 64, 0.3)',
  },
  heroGuildName: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: 1.2,
    letterSpacing: '-0.3px',
  },
  heroMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  heroDivider: {
    color: 'var(--text-muted)',
  },
  heroOnline: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  // Pulse dot
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#40FF40',
    boxShadow: '0 0 6px rgba(64, 255, 64, 0.5)',
    animation: 'subtle-breathe 2s ease-in-out infinite',
    flexShrink: 0,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  // Glass card (reusable)
  glassCard: {
    padding: '16px 20px',
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.7), rgba(21, 26, 21, 0.5))',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },

  // Status
  statusDisplay: {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'rgba(10, 15, 10, 0.5)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    fontFamily: "'Geist', sans-serif",
  },
  statusInputRow: {
    display: 'flex',
    gap: 8,
  },
  statusInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid var(--accent)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'Geist', sans-serif",
  },

  // MOTD
  motdLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--accent)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  motdText: {
    fontSize: 14,
    color: 'var(--text-primary)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },

  // Voice activity
  voiceGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  voiceCard: {
    padding: '16px 20px',
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.7), rgba(21, 26, 21, 0.5))',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--border)',
    borderRadius: 12,
  },
  voiceCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceChannelName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  voiceParticipantCount: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  voiceParticipants: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  voiceParticipant: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 6px',
    borderRadius: 6,
    fontSize: 13,
    transition: 'all 0.15s ease',
  },
  liveBadge: {
    fontSize: 9,
    color: '#40FF40',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    background: 'rgba(64, 255, 64, 0.12)',
    borderRadius: 4,
    padding: '2px 6px',
    flexShrink: 0,
  },

  // Members list
  membersList: {
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.7), rgba(21, 26, 21, 0.5))',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  memberListHeader: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 100px 1fr 60px',
    gap: 12,
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid var(--border)',
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  memberRow: {
    display: 'grid',
    gridTemplateColumns: '40px 1fr 100px 1fr 60px',
    gap: 12,
    alignItems: 'center',
    padding: '8px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    transition: 'background 0.1s',
    cursor: 'default',
  },
  memberAvatarWrap: {
    position: 'relative',
    flexShrink: 0,
    width: 32,
    height: 32,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: 'var(--success)',
    border: '2px solid #0e120e',
  },
  memberName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rankBadge: {
    fontSize: 10,
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'rgba(64, 255, 64, 0.08)',
    border: '1px solid rgba(64, 255, 64, 0.12)',
    borderRadius: 10,
    padding: '1px 8px',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    width: 'fit-content',
  },
  memberStatusCell: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  memberLinkCell: {
    textAlign: 'right',
  },
  profileLink: {
    fontSize: 11,
    color: 'var(--accent)',
    fontWeight: 500,
    cursor: 'pointer',
  },
  colAvatar: { width: 40 },
  colName: {},
  colRank: {},
  colStatus: {},
  colLink: { textAlign: 'right' },

  // Show more button
  showMoreBtn: {
    width: '100%',
    padding: '10px 0',
    marginTop: 12,
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Geist', sans-serif",
    transition: 'border-color 0.15s',
  },

  // About link in header
  aboutLink: {
    color: 'var(--accent)',
    cursor: 'pointer',
    fontWeight: 500,
  },

  // About modal
  aboutOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  aboutModal: {
    background: 'linear-gradient(135deg, rgba(14, 17, 14, 0.95), rgba(21, 26, 21, 0.95))',
    backdropFilter: 'blur(16px)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    width: 440,
    maxWidth: '90vw',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(64, 255, 64, 0.04)',
  },
  aboutHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  aboutClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
  },
  aboutBody: {
    padding: '20px',
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    overflowY: 'auto',
  },
};
