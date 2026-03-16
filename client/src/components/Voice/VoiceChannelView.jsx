import { useMemo } from 'react';
import { useVoiceContext, useVoicePresenceContext } from '../../contexts/VoiceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import Avatar from '../Common/Avatar';

function ParticipantCard({ participant, state, profilePicture, tier, isSelf }) {
  const config = TIER_CONFIG[tier];
  const { speaking, muted, deafened, screenSharing } = state;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: config.gap,
      padding: config.padding,
      borderRadius: 12,
      border: speaking ? '2px dotted #40FF40' : '2px solid transparent',
      background: speaking
        ? 'rgba(64, 255, 64, 0.06)'
        : 'rgba(255, 255, 255, 0.02)',
      boxShadow: speaking ? '0 0 16px rgba(64, 255, 64, 0.2)' : 'none',
      transition: 'all 0.2s ease',
      opacity: muted && !speaking ? 0.7 : 1,
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          borderRadius: '50%',
          border: speaking ? '3px solid #40FF40' : '3px solid transparent',
          padding: 2,
          transition: 'border-color 0.15s',
          boxShadow: speaking ? '0 0 12px rgba(64, 255, 64, 0.35)' : 'none',
        }}>
          <Avatar
            username={participant.username}
            color={participant.avatarColor}
            size={config.avatarSize}
            profilePicture={profilePicture}
          />
        </div>
        {tier !== 'compact' && (
          <div style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: tier === 'large' ? 14 : 10,
            height: tier === 'large' ? 14 : 10,
            borderRadius: '50%',
            background: '#40FF40',
            border: '2px solid var(--bg-primary)',
          }} />
        )}
      </div>

      <span className="truncate" style={{
        fontSize: config.fontSize,
        fontWeight: speaking ? 600 : 500,
        color: speaking ? '#40FF40' : 'var(--text-primary)',
        maxWidth: config.maxNameWidth,
        textAlign: 'center',
        transition: 'color 0.15s',
      }}>
        {participant.username}{isSelf ? ' (You)' : ''}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: config.iconSize }}>
        {deafened ? (
          <svg width={config.iconSize} height={config.iconSize} viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 9-9" />
            <path d="M21 14h-1a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-7" />
          </svg>
        ) : muted ? (
          <svg width={config.iconSize} height={config.iconSize} viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : speaking ? (
          <svg width={config.iconSize} height={config.iconSize} viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg width={config.iconSize} height={config.iconSize} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        {screenSharing && (
          <svg width={config.iconSize} height={config.iconSize} viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )}
      </div>
    </div>
  );
}

const TIER_CONFIG = {
  large: { avatarSize: 72, fontSize: 14, iconSize: 16, gap: 8, padding: 20, maxNameWidth: 140 },
  medium: { avatarSize: 52, fontSize: 13, iconSize: 14, gap: 6, padding: 16, maxNameWidth: 110 },
  compact: { avatarSize: 36, fontSize: 11, iconSize: 12, gap: 4, padding: 12, maxNameWidth: 80 },
};

const GRID_MIN_WIDTH = { large: 160, medium: 130, compact: 100 };

export default function VoiceChannelView({ channelId }) {
  const { voiceChannels, channelId: myChannelId, voiceE2E, e2eWarning } = useVoiceContext();
  const { peers, speaking: selfSpeaking } = useVoicePresenceContext();
  const { user } = useAuth();
  const { onlineUsers } = useOnlineUsers();

  const channel = voiceChannels.find(ch => ch.id === channelId);
  const participants = channel?.participants || [];
  const channelName = channel?.name || 'Voice';

  const profilePicMap = useMemo(() => {
    const map = {};
    onlineUsers.forEach(u => { if (u.profilePicture) map[u.userId] = u.profilePicture; });
    return map;
  }, [onlineUsers]);

  const count = participants.length;
  const tier = count <= 4 ? 'large' : count <= 12 ? 'medium' : 'compact';
  const secureVoiceState = e2eWarning
    ? 'blocked'
    : voiceE2E
      ? 'ready'
      : 'establishing';
  const secureVoiceColor = secureVoiceState === 'blocked'
    ? 'var(--danger)'
    : secureVoiceState === 'ready'
      ? 'var(--success)'
      : 'var(--accent)';
  const secureVoiceLabel = secureVoiceState === 'blocked'
    ? 'Secure Media Blocked'
    : secureVoiceState === 'ready'
      ? 'Secure Voice Connected'
      : 'Establishing Secure Voice';

  function getParticipantState(p) {
    const isSelf = p.userId === user.userId;
    const peerState = peers[p.userId];
    return {
      speaking: isSelf ? (channelId === myChannelId && selfSpeaking) : (peerState?.speaking || false),
      muted: peerState?.muted ?? p.muted ?? false,
      deafened: peerState?.deafened ?? p.deafened ?? false,
      screenSharing: peerState?.screenSharing ?? p.screenSharing ?? false,
    };
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          <span style={styles.channelName}>{channelName}</span>
        </div>
        <span style={styles.connectedCount}>{count} connected</span>
      </div>

      {e2eWarning && (
        <div style={styles.warningBanner}>
          {e2eWarning}
        </div>
      )}

      <div style={styles.gridScroll}>
        <div style={{
          ...styles.grid,
          gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH[tier]}px, 1fr))`,
          gap: tier === 'large' ? 20 : tier === 'medium' ? 16 : 12,
          justifyItems: 'center',
        }}>
          {participants.map(p => (
            <ParticipantCard
              key={p.userId}
              participant={p}
              state={getParticipantState(p)}
              profilePicture={profilePicMap[p.userId]}
              tier={tier}
              isSelf={p.userId === user.userId}
            />
          ))}
        </div>
      </div>

      <div style={styles.statusBar}>
        <div style={styles.statusLeft}>
          <div style={{
            ...styles.statusDot,
            background: secureVoiceColor,
            boxShadow: secureVoiceState === 'ready'
              ? '0 0 8px rgba(0, 214, 143, 0.4)'
              : secureVoiceState === 'blocked'
                ? '0 0 8px rgba(255, 71, 87, 0.4)'
                : '0 0 8px rgba(64, 255, 64, 0.25)',
          }} />
          <span style={{ ...styles.statusText, color: secureVoiceColor }}>
            {secureVoiceLabel}
          </span>
          <span style={styles.statusChannel}>{channelName}</span>
        </div>
        {secureVoiceState === 'ready' ? (
          <div style={styles.e2eBadge}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            E2E Encrypted
          </div>
        ) : secureVoiceState === 'establishing' ? (
          <div style={styles.pendingBadge}>Negotiating secure media</div>
        ) : (
          <div style={styles.blockedBadge}>Secure media unavailable</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--bg-primary)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid var(--border)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  channelName: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  connectedCount: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  warningBanner: {
    padding: '8px 24px',
    background: 'rgba(255, 71, 87, 0.1)',
    borderBottom: '1px solid rgba(255, 71, 87, 0.2)',
    color: 'var(--danger)',
    fontSize: 11,
    lineHeight: 1.5,
  },
  gridScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: 24,
  },
  grid: {
    display: 'grid',
    maxWidth: 900,
    margin: '0 auto',
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    borderTop: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  statusText: {
    fontWeight: 600,
  },
  statusChannel: {
    color: 'var(--text-muted)',
  },
  e2eBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--accent)',
  },
  blockedBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--danger)',
  },
  pendingBadge: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--accent)',
  },
};
