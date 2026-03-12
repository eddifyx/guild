import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useVoiceContext } from '../../contexts/VoiceContext';
import { useRooms } from '../../hooks/useRooms';
import { useNotifications } from '../../hooks/useNotifications';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { useUnreadDMs } from '../../hooks/useUnreadDMs';
import { useUnreadRooms } from '../../hooks/useUnreadRooms';
import { useGuild } from '../../contexts/GuildContext';
import { checkLatestVersion, getServerUrl, isInsecureConnection } from '../../api';
import { warmRoomMessageCache } from '../../hooks/useMessages';
import { isE2EInitialized, wasE2EExpected } from '../../crypto/sessionManager';
import Sidebar from './Sidebar';
import ChatView from '../Chat/ChatView';
import AssetDumpView from '../AssetDump/AssetDumpView';
import AddonView from '../Addons/AddonView';
import StreamView from '../Stream/StreamView';
import StreamPiP from '../Stream/StreamPiP';
import NostrProfileView from '../Social/NostrProfileView';
import GuildDashboard from '../Guild/GuildDashboard';
import VoiceChannelView from '../Voice/VoiceChannelView';
import UpdateOverlay from '../Common/UpdateOverlay';
import VerifyIdentityModal from '../Chat/VerifyIdentityModal';

export default function MainLayout() {
  const { socket } = useSocket();
  const { currentGuild, currentGuildData } = useGuild();
  const { rooms, myRooms, createRoom, joinRoom, leaveRoom, renameRoom, deleteRoom, refreshRooms } = useRooms(currentGuild);
  const [conversation, setConversation] = useState(null);
  const [conversationName, setConversationName] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [showUpdateOverlay, setShowUpdateOverlay] = useState(false);
  const [versionToast, setVersionToast] = useState(null);
  const [showPiP, setShowPiP] = useState(false);
  const [e2eWarning, setE2eWarning] = useState(false);
  const [showVerifyIdentity, setShowVerifyIdentity] = useState(false);

  // Listen for E2E init failure events from AuthContext
  useEffect(() => {
    const onE2eFailed = () => setE2eWarning(true);
    window.addEventListener('e2e-init-failed', onE2eFailed);
    // Check current state on mount (in case failure already happened)
    if (wasE2EExpected()) setE2eWarning(true);
    return () => window.removeEventListener('e2e-init-failed', onE2eFailed);
  }, []);

  // Clear warning if E2E initializes later (e.g. reconnect succeeds)
  useEffect(() => {
    if (e2eWarning && isE2EInitialized()) setE2eWarning(false);
  });

  useNotifications(conversation);
  const { unreadCounts, clearUnread } = useUnreadDMs(conversation);
  const { unreadRoomCounts, clearUnreadRoom } = useUnreadRooms(conversation);
  const { user } = useAuth();
  const { screenSharing, voiceChannels, channelId, peers } = useVoiceContext();

  const activeVoiceChannel = channelId
    ? voiceChannels.find(ch => ch.id === channelId) || null
    : null;
  const activePeerStreamerId = !screenSharing
    ? (Object.entries(peers || {}).find(([, state]) => state?.screenSharing)?.[0] || null)
    : null;
  const activeRemoteStreamer = !screenSharing
    ? (activePeerStreamerId
      ? ((activeVoiceChannel?.participants || []).find(p => p.userId === activePeerStreamerId)
        || voiceChannels.flatMap(ch => ch.participants || []).find(p => p.userId === activePeerStreamerId)
        || { userId: activePeerStreamerId, username: 'Stream' })
      : ((activeVoiceChannel?.participants || []).find(p => p.screenSharing && p.userId !== user?.userId) || null))
    : null;
  const streamConversationMatchesActiveVoice = conversation?.type === 'stream'
    && !!channelId
    && !!activeVoiceChannel
    && (activeVoiceChannel.participants || []).some(p => p.userId === conversation.id);

  // Auto-navigate to own stream view when screen sharing starts; restore on stop
  const prevConversationRef = useRef(undefined);
  const prevConversationNameRef = useRef(undefined);
  const prevJoinedVoiceChannelIdRef = useRef(null);
  useEffect(() => {
    if (screenSharing) {
      prevConversationRef.current = conversation;
      prevConversationNameRef.current = conversationName;
      setConversation({ type: 'stream', id: user.userId });
      setConversationName(`${user.username || 'Your'}'s Stream`);
    } else if (prevConversationRef.current !== undefined) {
      setConversation(prevConversationRef.current);
      setConversationName(prevConversationNameRef.current || '');
      prevConversationRef.current = undefined;
      prevConversationNameRef.current = undefined;
    }
  }, [screenSharing]);

  useEffect(() => {
    if (screenSharing || !channelId || !activeVoiceChannel) return;

    if (conversation?.type === 'voice' && conversation.id === channelId && activeRemoteStreamer) {
      setConversation({ type: 'stream', id: activeRemoteStreamer.userId });
      setConversationName(activeRemoteStreamer.username + "'s Stream");
      return;
    }

    if (conversation?.type === 'stream' && streamConversationMatchesActiveVoice) {
      if (activeRemoteStreamer) {
        if (conversation.id !== activeRemoteStreamer.userId) {
          setConversation({ type: 'stream', id: activeRemoteStreamer.userId });
          setConversationName(activeRemoteStreamer.username + "'s Stream");
        }
        return;
      }

      setConversation({ type: 'voice', id: channelId });
      setConversationName(activeVoiceChannel.name || 'Voice');
    }
  }, [
    screenSharing,
    channelId,
    activeVoiceChannel,
    activeRemoteStreamer,
    streamConversationMatchesActiveVoice,
    conversation?.type,
    conversation?.id,
  ]);

  // Show PiP when navigating away from stream view while a stream is active
  const prevConvTypeRef = useRef(conversation?.type);
  useEffect(() => {
    const prevType = prevConvTypeRef.current;
    prevConvTypeRef.current = conversation?.type;

    if (prevType === 'stream' && conversation?.type !== 'stream') {
      // Only show PiP if there's actually an active stream
      const hasActiveStream = screenSharing || (channelId && voiceChannels.some(ch =>
        ch.id === channelId && (ch.participants || []).some(p => p.screenSharing)
      ));
      if (hasActiveStream) setShowPiP(true);
    }
    if (conversation?.type === 'stream') {
      setShowPiP(false);
    }
  }, [conversation, screenSharing, channelId, voiceChannels]);

  // Fetch local version + check server for newer version on mount + every 30 minutes
  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(v => setAppVersion(v || ''));
    const check = () => checkLatestVersion().then(({ hasUpdate }) => {
      if (hasUpdate) setUpdateAvailable(true);
    });
    check();
    const interval = setInterval(check, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-join rooms via socket when connecting
  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => {
      myRooms.forEach(room => {
        socket.emit('room:join', { roomId: room.id });
      });
    };
    if (socket.connected) handleConnect();
    socket.on('connect', handleConnect);
    return () => socket.off('connect', handleConnect);
  }, [socket, myRooms]);

  // Warm recent room messages in the background so room opens feel instant.
  useEffect(() => {
    if (!socket || !user?.userId || myRooms.length === 0 || !isE2EInitialized()) return;

    let cancelled = false;
    const warm = () => {
      window.setTimeout(() => {
        if (cancelled) return;
        warmRoomMessageCache(myRooms, user.userId).catch((err) => {
          console.warn('[Rooms] Background room warm failed:', err?.message || err);
        });
      }, 150);
    };

    if (socket.connected) warm();
    socket.on('connect', warm);
    return () => {
      cancelled = true;
      socket.off('connect', warm);
    };
  }, [socket, myRooms, user?.userId]);

  // Clear conversation if the active room gets deleted or renamed
  useEffect(() => {
    if (!socket) return;
    const onDeleted = ({ roomId }) => {
      if (conversation?.type === 'room' && conversation.id === roomId) {
        setConversation(null);
        setConversationName('');
      }
    };
    const onRenamed = ({ roomId, name }) => {
      if (conversation?.type === 'room' && conversation.id === roomId) {
        setConversationName(name);
      }
    };
    socket.on('room:deleted', onDeleted);
    socket.on('room:renamed', onRenamed);
    return () => {
      socket.off('room:deleted', onDeleted);
      socket.off('room:renamed', onRenamed);
    };
  }, [socket, conversation]);

  const handleSelectRoom = (room) => {
    if (!room) {
      setConversation(null);
      setConversationName('');
      return;
    }
    if (socket) socket.emit('room:join', { roomId: room.id });
    setConversation({ type: 'room', id: room.id });
    setConversationName(room.name);
    clearUnreadRoom(room.id);
  };

  const handleSelectDM = (conv) => {
    setConversation({ type: 'dm', id: conv.other_user_id, npub: conv.other_npub || null });
    setConversationName(conv.other_username);
    clearUnread(conv.other_user_id);
  };

  const handleSelectAssetDump = () => {
    setConversation({ type: 'assets', id: 'dump' });
    setConversationName('Asset Dumping Grounds');
  };

  const handleSelectAddons = () => {
    setConversation({ type: 'addons', id: 'addons' });
    setConversationName('Addons');
  };

  const handleSelectStream = (userId, username) => {
    setConversation({ type: 'stream', id: userId || null });
    setConversationName(userId ? `${username}'s Stream` : 'Stream');
  };

  const handleSelectNostrProfile = () => {
    setConversation({ type: 'nostr-profile' });
    setConversationName(user?.username || 'Profile');
  };

  const handleSelectVoiceChannel = (chId, chName) => {
    setConversation({ type: 'voice', id: chId });
    setConversationName(chName || 'Voice');
  };

  // Auto-navigate to the active voice or stream view when the joined voice channel changes.
  useEffect(() => {
    if (channelId) {
      if (prevJoinedVoiceChannelIdRef.current === channelId) return;
      if (!activeVoiceChannel) return;

      prevJoinedVoiceChannelIdRef.current = channelId;

      if (screenSharing) return;

      if (activeRemoteStreamer) {
        setConversation({ type: 'stream', id: activeRemoteStreamer.userId });
        setConversationName(activeRemoteStreamer.username + "'s Stream");
        return;
      }

      setConversation({ type: 'voice', id: channelId });
      setConversationName(activeVoiceChannel.name || 'Voice');
      return;
    }

    if (!channelId && prevJoinedVoiceChannelIdRef.current) {
      prevJoinedVoiceChannelIdRef.current = null;
      if (conversation?.type === 'voice' || conversation?.type === 'stream') {
        setConversation(null);
        setConversationName('');
      }
    }
  }, [
    channelId,
    activeVoiceChannel,
    activeRemoteStreamer,
    screenSharing,
    conversation?.type,
  ]);

  const { onlineUsers, onlineIds } = useOnlineUsers();
  const isOnline = conversation?.type === 'dm' && onlineIds.has(conversation.id);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    }}>
      {isInsecureConnection() && (
        <div style={{
          padding: '4px 12px', background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          fontSize: 11, color: '#ef4444', textAlign: 'center',
          flexShrink: 0, WebkitAppRegion: 'no-drag',
        }}>
          Insecure connection — using unencrypted HTTP. Use HTTPS for production.
        </div>
      )}
      {e2eWarning && (
        <div style={{
          padding: '4px 12px', background: 'rgba(239, 68, 68, 0.12)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
          fontSize: 11, color: '#ef4444', textAlign: 'center',
          flexShrink: 0, WebkitAppRegion: 'no-drag',
        }}>
          E2E encryption failed to initialize. Messages cannot be sent until encryption is restored.
        </div>
      )}
      {versionToast && (
        <>
          <style>{`
            @keyframes toastSlideIn {
              from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
              to { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
          <div
            onClick={() => setVersionToast(null)}
            style={{
              position: 'fixed',
              top: 48,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9998,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--accent)',
              borderRadius: 8,
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              animation: 'toastSlideIn 0.2s ease',
              cursor: 'pointer',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{versionToast}</span>
          </div>
        </>
      )}
      {showUpdateOverlay && (
        <UpdateOverlay
          serverUrl={getServerUrl()}
          onDismiss={() => setShowUpdateOverlay(false)}
        />
      )}
      {/* Title bar — unified top bar with logo, channel info, and controls */}
      <div style={{
        height: 42,
        minHeight: 42,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        WebkitAppRegion: 'drag',
      }}>
        {/* Left: logo + brand — matches Sidebar width */}
        <div style={{
          width: 260,
          minWidth: 260,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 6,
          paddingLeft: 16,
          borderRight: '1px solid var(--border)',
          height: '100%',
          overflow: 'hidden',
        }}>
          <span style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Geist', sans-serif",
            color: '#40FF40',
            textShadow: '0 0 12px rgba(64, 255, 64, 0.4), 0 0 24px rgba(64, 255, 64, 0.15)',
            letterSpacing: '-0.5px',
          }}>
            /guild
          </span>
        </div>

        {/* Center: channel / conversation info */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 16,
          minWidth: 0,
        }}>
          {conversation?.type === 'room' && (
            <>
              <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>#</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                {conversationName}
              </span>
            </>
          )}
          {conversation?.type === 'dm' && (
            <>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: isOnline ? 'var(--success)' : 'var(--text-muted)',
                boxShadow: isOnline ? '0 0 6px rgba(0, 214, 143, 0.4)' : 'none',
              }} />
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                {conversationName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {isE2EInitialized() && (
                <button
                  onClick={() => setShowVerifyIdentity(true)}
                  title="Verify identity"
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
                    marginLeft: 4, transition: 'color 0.15s', WebkitAppRegion: 'no-drag',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#40FF40'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </button>
              )}
            </>
          )}
          {conversation?.type === 'assets' && (
            <>
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 8v13H3V3h12l6 5z" />
                  <path d="M14 3v6h6" />
                </svg>
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                Asset Dumping Grounds
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Files expire after 5 days
              </span>
            </>
          )}
          {conversation?.type === 'addons' && (
            <>
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                Addons
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Files stored permanently
              </span>
            </>
          )}
          {conversation?.type === 'nostr-profile' && (
            <>
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                {conversationName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Nostr Profile
              </span>
            </>
          )}
          {conversation?.type === 'stream' && (() => {
            const isLive = conversation.id === user.userId
              ? screenSharing
              : channelId && voiceChannels.some(ch =>
                  ch.id === channelId && ch.participants?.some(p => p.screenSharing)
                );
            return (
              <>
                <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </span>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {conversationName || 'Stream'}
                </span>
                {isLive && (
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
              </>
            );
          })()}
          {conversation?.type === 'voice' && (
            <>
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </span>
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                {conversationName}
              </span>
            </>
          )}
        </div>

        {/* Right: update button + window controls */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: '100%', WebkitAppRegion: 'no-drag' }}>
          <button
            onClick={() => {
              if (updateAvailable) {
                setShowUpdateOverlay(true);
              } else {
                checkLatestVersion().then(({ hasUpdate, remoteVersion }) => {
                  if (hasUpdate) {
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
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0 14px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
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
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0 14px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s',
            }}
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
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0 14px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.15s, color 0.15s',
            }}
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

      {/* Stream PiP overlay */}
      {showPiP && (
        <StreamPiP
          position={conversation?.type === 'assets' || conversation?.type === 'addons' ? 'bottom-right' : 'top-right'}
          onNavigate={(userId, username) => {
            handleSelectStream(userId, username);
            setShowPiP(false);
          }}
          onClose={() => setShowPiP(false)}
        />
      )}

      {/* Content row */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          rooms={rooms}
          myRooms={myRooms}
          createRoom={createRoom}
          joinRoom={joinRoom}
          renameRoom={renameRoom}
          deleteRoom={deleteRoom}
          conversation={conversation}
          onSelectRoom={handleSelectRoom}
          onSelectDM={handleSelectDM}
          onSelectAssetDump={handleSelectAssetDump}
          onSelectAddons={handleSelectAddons}
          onSelectStream={handleSelectStream}
          onSelectNostrProfile={handleSelectNostrProfile}
          onSelectVoiceChannel={handleSelectVoiceChannel}
          unreadCounts={unreadCounts}
          unreadRoomCounts={unreadRoomCounts}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {conversation?.type === 'assets'
            ? <AssetDumpView />
            : conversation?.type === 'addons'
              ? <AddonView />
              : conversation?.type === 'stream'
                ? <StreamView userId={conversation.id} />
                : conversation?.type === 'nostr-profile'
                  ? <NostrProfileView />
                  : conversation?.type === 'voice'
                    ? <VoiceChannelView channelId={conversation.id} />
                    : conversation
                    ? <ChatView conversation={conversation} />
                    : <GuildDashboard onSelectDM={handleSelectDM} />
          }
        </div>
      </div>
      {showVerifyIdentity && conversation?.type === 'dm' && (
        <VerifyIdentityModal
          userId={conversation.id}
          username={conversationName}
          onClose={() => setShowVerifyIdentity(false)}
          onVerified={() => setShowVerifyIdentity(false)}
        />
      )}
    </div>
  );
}
