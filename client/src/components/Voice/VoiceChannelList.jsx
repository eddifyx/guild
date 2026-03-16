import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useVoiceContext, useVoicePresenceContext } from '../../contexts/VoiceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import Avatar from '../Common/Avatar';
import Modal from '../Common/Modal';

function VoiceChannelList({ onSelectStream, onSelectVoiceChannel }) {
  const { user } = useAuth();
  const { currentGuildData } = useGuild();
  const { voiceChannels, channelId, joinChannel, deleteVoiceChannel, joinError, setUserVolume } = useVoiceContext();
  const { peers, speaking: selfSpeaking } = useVoicePresenceContext();
  const { onlineUsers } = useOnlineUsers();
  const [volumeMenu, setVolumeMenu] = useState(null); // { x, y, userId, username }
  const [volumes, setVolumes] = useState({}); // { userId: 0-100 }
  const [mutedUsers, setMutedUsers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('voice:mutedUsers') || '{}'); } catch { return {}; }
  });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const menuRef = useRef(null);
  const onlineUsersById = useMemo(() => new Map(
    onlineUsers.map((entry) => [entry.userId, entry])
  ), [onlineUsers]);

  // Close menu on outside click
  useEffect(() => {
    if (!volumeMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setVolumeMenu(null);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [volumeMenu]);

  const handleVolumeChange = useCallback((userId, value) => {
    const vol = parseInt(value, 10);
    setVolumes(prev => ({ ...prev, [userId]: vol }));
    setUserVolume(userId, vol / 100);
  }, [setUserVolume]);

  const toggleUserMute = useCallback((userId) => {
    setMutedUsers(prev => {
      const isMuted = !prev[userId];
      const next = { ...prev, [userId]: isMuted };
      localStorage.setItem('voice:mutedUsers', JSON.stringify(next));
      // Set volume to 0 when muted, restore when unmuted
      if (isMuted) {
        setUserVolume(userId, 0);
      } else {
        const savedVol = volumes[userId] !== undefined ? volumes[userId] : 100;
        setUserVolume(userId, savedVol / 100);
      }
      return next;
    });
  }, [setUserVolume, volumes]);

  const getUserVolume = (userId) => {
    if (volumes[userId] !== undefined) return volumes[userId];
    const saved = localStorage.getItem(`voice:userVolume:${userId}`);
    if (saved !== null) return Math.round(parseFloat(saved) * 100);
    return 100;
  };

  function getParticipantState(p, chId) {
    const isSelf = p.userId === user.userId;
    const peerState = peers[p.userId];
    return {
      speaking: isSelf ? (chId === channelId && selfSpeaking) : (peerState?.speaking || false),
      muted: peerState?.muted ?? p.muted ?? false,
      deafened: peerState?.deafened ?? p.deafened ?? false,
      screenSharing: peerState?.screenSharing ?? p.screenSharing ?? false,
    };
  }

  return (
    <div>
      {voiceChannels.map(ch => {
        const isActive = channelId === ch.id;
        const participants = ch.participants || [];
        const hasActiveStream = participants.some(p => getParticipantState(p, ch.id).screenSharing);
        const canDeleteChannel = ch.created_by === user.userId || currentGuildData?.myRank?.order === 0;

        return (
          <div key={ch.id}>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
              <button
              onClick={() => {
                if (isActive) {
                  const streamer = participants.find(p => getParticipantState(p, ch.id).screenSharing);
                  if (streamer && onSelectStream) {
                    onSelectStream(streamer.userId, streamer.username);
                  } else if (onSelectVoiceChannel) {
                    onSelectVoiceChannel(ch.id, ch.name);
                  }
                } else {
                  joinChannel(ch.id);
                }
              }}
              style={{
                flex: 1,
                width: '100%',
                padding: '7px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6, flexShrink: 0 }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              <span style={{ flex: 1 }}>{ch.name}</span>
              {isActive && hasActiveStream && (
                <span style={{
                  fontSize: 9,
                  color: '#40FF40',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  opacity: 0.9,
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  LIVE
                </span>
              )}
              {participants.length > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {participants.length}
                </span>
              )}
              </button>
              {canDeleteChannel && (
                <button
                  type="button"
                  aria-label={`Delete ${ch.name}`}
                  title="Delete voice channel"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteError('');
                    setDeleteConfirm({ id: ch.id, name: ch.name });
                  }}
                  style={{
                    width: 32,
                    border: 'none',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(255, 71, 87, 0.12)';
                    e.currentTarget.style.color = 'var(--danger)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              )}
            </div>

            {participants.length > 0 && (
              <div style={{ paddingLeft: 32, paddingBottom: 4 }}>
                {participants.map(p => {
                  const state = getParticipantState(p, ch.id);
                  return (
                    <div
                      key={p.userId}
                      onContextMenu={(e) => {
                        if (p.userId === user.userId) return;
                        e.preventDefault();
                        setVolumeMenu({ x: e.clientX, y: e.clientY, userId: p.userId, username: p.username });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 4px',
                        borderRadius: 4,
                        fontSize: 11,
                        color: state.speaking ? '#40FF40' : 'var(--text-secondary)',
                        background: state.speaking ? 'rgba(64, 255, 64, 0.06)' : 'transparent',
                        transition: 'all 0.15s ease',
                        cursor: p.userId !== user.userId ? 'context-menu' : 'default',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20,
                        borderRadius: '50%',
                        border: state.speaking ? '2px solid #40FF40' : '2px solid transparent',
                        boxShadow: state.speaking ? '0 0 6px rgba(64, 255, 64, 0.4)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                        flexShrink: 0,
                      }}>
                        <Avatar username={p.username} color={p.avatarColor} size={14} profilePicture={onlineUsersById.get(p.userId)?.profilePicture} />
                      </div>
                      <span
                        className="truncate"
                        style={{
                          flex: 1,
                          fontWeight: state.speaking ? 600 : 400,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p.username}
                      </span>
                      {state.screenSharing && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#40FF40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" title="Sharing screen">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                      {state.muted && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                          <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .67-.1 1.32-.27 1.93" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      )}
                      {state.deafened && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23" />
                          <path d="M6 18.7A7 7 0 0 1 5 12V9" />
                          <path d="M19 12v-2a7 7 0 0 0-12.37-4.47" />
                          <path d="M9 9h6v4" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Join error message */}
      {joinError && (
        <div style={{
          padding: '6px 12px',
          fontSize: 11,
          color: 'var(--danger)',
          background: 'rgba(255, 71, 87, 0.1)',
          borderRadius: 4,
          margin: '4px 0',
        }}>
          {joinError}
        </div>
      )}

      {/* Volume slider context menu */}
      {deleteConfirm && (
        <Modal
          title="Delete Voice Channel"
          onClose={() => {
            setDeleteConfirm(null);
            setDeleteError('');
          }}
        >
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
            Delete voice channel "{deleteConfirm.name}"? Everyone inside will be disconnected.
          </div>
          {deleteError && (
            <div style={{
              marginBottom: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444',
              fontSize: 11,
            }}>
              {deleteError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirm(null);
                setDeleteError('');
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await deleteVoiceChannel(deleteConfirm.id);
                  setDeleteConfirm(null);
                  setDeleteError('');
                } catch (err) {
                  setDeleteError(err?.message || 'Failed to delete voice channel.');
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255, 71, 87, 0.3)',
                background: 'rgba(255, 71, 87, 0.12)',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Delete Channel
            </button>
          </div>
        </Modal>
      )}

      {volumeMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: volumeMenu.y,
            left: volumeMenu.x,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            padding: '10px 14px',
            zIndex: 2000,
            minWidth: 200,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            animation: 'fadeIn 0.1s ease-out',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
            }}>
              {volumeMenu.username}
            </span>
            <button
              onClick={() => setVolumeMenu(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 2,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              value={mutedUsers[volumeMenu.userId] ? 0 : getUserVolume(volumeMenu.userId)}
              onChange={(e) => {
                // If muted and user drags slider, unmute first
                if (mutedUsers[volumeMenu.userId]) {
                  setMutedUsers(prev => {
                    const next = { ...prev, [volumeMenu.userId]: false };
                    localStorage.setItem('voice:mutedUsers', JSON.stringify(next));
                    return next;
                  });
                }
                handleVolumeChange(volumeMenu.userId, e.target.value);
              }}
              style={{
                flex: 1,
                height: 4,
                accentColor: 'var(--accent)',
                cursor: 'pointer',
              }}
            />
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: 28,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {mutedUsers[volumeMenu.userId] ? '0' : getUserVolume(volumeMenu.userId)}%
            </span>
          </div>
          <button
            onClick={() => toggleUserMute(volumeMenu.userId)}
            style={{
              width: '100%',
              marginTop: 8,
              padding: '6px 0',
              background: mutedUsers[volumeMenu.userId] ? 'rgba(255, 71, 87, 0.15)' : 'var(--bg-hover)',
              border: '1px solid',
              borderColor: mutedUsers[volumeMenu.userId] ? 'rgba(255, 71, 87, 0.3)' : 'var(--border)',
              borderRadius: 6,
              color: mutedUsers[volumeMenu.userId] ? 'var(--danger)' : 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = mutedUsers[volumeMenu.userId] ? 'rgba(255, 71, 87, 0.25)' : 'rgba(255, 255, 255, 0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = mutedUsers[volumeMenu.userId] ? 'rgba(255, 71, 87, 0.15)' : 'var(--bg-hover)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mutedUsers[volumeMenu.userId] ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </>
              )}
            </svg>
            {mutedUsers[volumeMenu.userId] ? 'Unmute' : 'Mute'}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(VoiceChannelList);
