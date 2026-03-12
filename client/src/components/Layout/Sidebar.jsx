import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useVoiceContext } from '../../contexts/VoiceContext';
import { useGuild } from '../../contexts/GuildContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { api, getFileUrl } from '../../api';
import Avatar from '../Common/Avatar';
import RoomList from '../Rooms/RoomList';
import DMList from '../DirectMessages/DMList';
import VoiceChannelList from '../Voice/VoiceChannelList';
import VoiceControls from '../Voice/VoiceControls';
import AudioSettings from '../Voice/AudioSettings';
import CreateRoomModal from '../Rooms/CreateRoomModal';
import NewDMModal from '../DirectMessages/NewDMModal';
import CreateVoiceChannelModal from '../Voice/CreateVoiceChannelModal';
import GuildSettingsModal from '../Guild/GuildSettingsModal';
import InviteGuildModal from '../Guild/InviteGuildModal';
import UserProfileCard from '../Common/UserProfileCard';
import { rememberUserNpub, rememberUsers, trustUserNpub } from '../../crypto/identityDirectory.js';


export default function Sidebar({ rooms, myRooms, createRoom, joinRoom, renameRoom, deleteRoom, conversation, onSelectRoom, onSelectDM, onSelectAssetDump, onSelectAddons, onSelectStream, onSelectNostrProfile, onSelectVoiceChannel, unreadCounts, unreadRoomCounts }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { onlineUsers, onlineIds } = useOnlineUsers();
  const { createVoiceChannel, voiceChannels } = useVoiceContext();
  const { currentGuild, currentGuildData } = useGuild();
  const [dmConversations, setDMConversations] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showCreateVoice, setShowCreateVoice] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showGuildSettings, setShowGuildSettings] = useState(false);
  const [showInviteGuild, setShowInviteGuild] = useState(false);
  const [profileCard, setProfileCard] = useState(null);
  const [sidebarGuildImgFailed, setSidebarGuildImgFailed] = useState(false);
  const prevSidebarGuildImg = useRef(currentGuildData?.image_url);
  if (prevSidebarGuildImg.current !== currentGuildData?.image_url) {
    prevSidebarGuildImg.current = currentGuildData?.image_url;
    setSidebarGuildImgFailed(false);
  }

  const [muteRooms, setMuteRooms] = useState(() => localStorage.getItem('notify:muteRooms') === 'true');
  const [muteDMs, setMuteDMs] = useState(() => localStorage.getItem('notify:muteDMs') === 'true');

  useEffect(() => {
    rememberUsers(onlineUsers);
  }, [onlineUsers]);

  const refreshDmConversations = useCallback(async () => {
    const convs = await api('/api/dm/conversations');
    rememberUsers(convs);
    const next = convs.map(c => ({
      other_user_id: c.other_user_id,
      other_username: c.other_username,
      other_avatar_color: c.other_avatar_color,
      other_npub: c.other_npub || null,
    }));
    setDMConversations(next);
  }, []);

  useEffect(() => {
    refreshDmConversations().catch(console.error);
  }, [refreshDmConversations, currentGuild]);

  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !user) return;

    const handleDM = (msg) => {
      const otherId = msg.sender_id === user.userId ? msg.dm_partner_id : msg.sender_id;
      const otherName = msg.sender_id === user.userId ? null : msg.sender_name;
      if (msg.sender_id !== user.userId && msg.sender_npub) {
        rememberUserNpub(otherId, msg.sender_npub);
      }

      setDMConversations(prev => {
        const exists = prev.find(c => c.other_user_id === otherId);
        if (exists) return prev;
        return [...prev, {
          other_user_id: otherId,
          other_username: otherName || otherId,
          other_avatar_color: msg.sender_color || '#40FF40',
          other_npub: msg.sender_id === user.userId ? null : (msg.sender_npub || null),
        }];
      });
    };

    socket.on('dm:message', handleDM);
    return () => socket.off('dm:message', handleDM);
  }, [socket, user]);

  const handleSelectDMUser = (u) => {
    if (u.npub) {
      if (u.trustedBootstrap) {
        trustUserNpub(u.id, u.npub);
      } else {
        rememberUserNpub(u.id, u.npub);
      }
    }
    setDMConversations(prev => {
      const exists = prev.find(c => c.other_user_id === u.id);
      if (exists) return prev;
      return [...prev, {
        other_user_id: u.id,
        other_username: u.username,
        other_avatar_color: u.avatar_color,
        other_npub: u.npub || null,
      }];
    });
    onSelectDM({ other_user_id: u.id, other_username: u.username, other_npub: u.npub || null });
  };

  const sectionHeader = (label, actions) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '6px 12px',
      marginBottom: 2,
    }}>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        letterSpacing: '1.2px',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {actions}
      </div>
    </div>
  );

  const iconBtn = (onClick, title, children) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        borderRadius: 4,
        transition: 'color 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
    >
      {children}
    </button>
  );

  const plusIcon = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

  const gearIcon = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;

  return (
    <div style={{
      width: 260,
      minWidth: 260,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* User bar */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div onClick={onSelectNostrProfile} style={{ cursor: 'pointer', flexShrink: 0 }} title="Nostr profile">
          <Avatar username={user.username} color={user.avatarColor} size={28} profilePicture={user.profilePicture} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="truncate" style={{ fontWeight: 500, fontSize: 13, color: 'var(--text-primary)' }}>
            {user.username}
          </div>
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: connected ? 'var(--success)' : 'var(--danger)',
            boxShadow: connected ? '0 0 6px rgba(0, 214, 143, 0.4)' : 'none',
            flexShrink: 0,
          }} />
        </div>
        <button
          onClick={logout}
          title="Log out"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            WebkitAppRegion: 'no-drag',
            borderRadius: 4,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>

      {/* Guild header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <button
          onClick={() => onSelectRoom(null)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {currentGuildData?.image_url && !sidebarGuildImgFailed ? (
            <img src={getFileUrl(currentGuildData.image_url)} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} onError={() => setSidebarGuildImgFailed(true)} />
          ) : (
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
            }}>
              {currentGuildData?.name?.[0]?.toUpperCase() || 'G'}
            </div>
          )}
          <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {currentGuildData?.name || 'Guild'}
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => setShowInviteGuild(true)}
            title="Invite to guild"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              borderRadius: 4, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          </button>
          <button
            onClick={() => setShowGuildSettings(true)}
            title="Guild settings"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
              borderRadius: 4, transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      {/* Scrollable sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', WebkitAppRegion: 'no-drag' }}>
        {/* Rooms */}
        <div style={{ marginBottom: 16 }}>
          {sectionHeader('Rooms',
            <>
              {iconBtn(() => {
                const next = !muteRooms;
                setMuteRooms(next);
                localStorage.setItem('notify:muteRooms', String(next));
              }, muteRooms ? 'Unmute room notifications' : 'Mute room notifications',
                muteRooms ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                    <path d="M18 8a6 6 0 0 0-9.33-5" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )
              )}
              {iconBtn(() => setShowCreateRoom(true), 'Create room', plusIcon)}
            </>
          )}
          <RoomList
            rooms={rooms}
            myRooms={myRooms}
            activeId={conversation?.type === 'room' ? conversation.id : null}
            onSelect={(room) => onSelectRoom(room)}
            onRename={renameRoom}
            onDelete={deleteRoom}
            unreadCounts={unreadRoomCounts}
          />
        </div>

        {/* Voice Channels */}
        <div style={{ marginBottom: 16 }}>
          {sectionHeader('Voice',
            <>
              {iconBtn(() => setShowAudioSettings(true), 'Audio settings', gearIcon)}
              {iconBtn(() => setShowCreateVoice(true), 'Create voice channel', plusIcon)}
            </>
          )}
          <VoiceChannelList onSelectStream={onSelectStream} onSelectVoiceChannel={onSelectVoiceChannel} />
        </div>

        {/* Asset Dump */}
        <div style={{ marginBottom: 16 }}>
          {sectionHeader('Asset Dump')}
          <button
            onClick={() => onSelectAssetDump()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              border: 'none',
              borderRadius: 6,
              background: conversation?.type === 'assets' ? 'var(--bg-active)' : 'transparent',
              color: conversation?.type === 'assets' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              transition: 'all 0.15s',
              fontWeight: conversation?.type === 'assets' ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (conversation?.type !== 'assets') {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (conversation?.type !== 'assets') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <span style={{
              color: conversation?.type === 'assets' ? 'var(--accent)' : 'var(--text-muted)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8v13H3V3h12l6 5z" />
                <path d="M14 3v6h6" />
              </svg>
            </span>
            <span className="truncate">Dumping Grounds</span>
          </button>
          <button
            onClick={() => onSelectAddons()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              border: 'none',
              borderRadius: 6,
              background: conversation?.type === 'addons' ? 'var(--bg-active)' : 'transparent',
              color: conversation?.type === 'addons' ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 13,
              transition: 'all 0.15s',
              fontWeight: conversation?.type === 'addons' ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (conversation?.type !== 'addons') {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (conversation?.type !== 'addons') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            <span style={{
              color: conversation?.type === 'addons' ? 'var(--accent)' : 'var(--text-muted)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </span>
            <span className="truncate">Addons</span>
          </button>
        </div>

        {/* DMs */}
        <div style={{ marginBottom: 16 }}>
          {sectionHeader('Messages',
            <>
              {iconBtn(() => {
                const next = !muteDMs;
                setMuteDMs(next);
                localStorage.setItem('notify:muteDMs', String(next));
              }, muteDMs ? 'Unmute DM notifications' : 'Mute DM notifications',
                muteDMs ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                    <path d="M18 8a6 6 0 0 0-9.33-5" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                )
              )}
              {iconBtn(() => setShowNewDM(true), 'New DM', plusIcon)}
            </>
          )}
          <DMList
            conversations={dmConversations}
            activeId={conversation?.type === 'dm' ? conversation.id : null}
            onSelect={(conv) => onSelectDM(conv)}
            unreadCounts={unreadCounts}
            onRemove={(otherUserId) => {
              if (!socket) return;
              socket.emit('dm:conversation:delete', { otherUserId });
              setDMConversations(prev => prev.filter(c => c.other_user_id !== otherUserId));
              if (conversation?.type === 'dm' && conversation.id === otherUserId) {
                onSelectRoom(null);
              }
            }}
            onlineIds={onlineIds}
          />
        </div>

        {/* Online Users */}
        <div>
          {sectionHeader(`Online \u2014 ${onlineUsers.length}`)}
          <div style={{ padding: '0 4px' }}>
            {onlineUsers.map(u => (
              <div
                key={u.userId}
                onClick={(e) => {
                  if (u.userId === user?.userId) return;
                  setProfileCard({ user: u, position: { x: e.clientX, y: e.clientY } });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: u.userId === user?.userId ? 'default' : 'pointer',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (u.userId !== user?.userId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar username={u.username} color={u.avatarColor} size={22} profilePicture={u.profilePicture} />
                  <div style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--success)',
                    border: '1.5px solid var(--bg-secondary)',
                  }} />
                </div>
                <span className="truncate" style={{ flex: 1, color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {u.username}
                </span>
              </div>
            ))}
            {onlineUsers.length === 0 && (
              <div style={{ padding: '8px 8px', fontSize: 12, color: 'var(--text-muted)' }}>
                No one online
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Voice controls */}
      <VoiceControls />

      {/* Modals */}
      {showCreateRoom && (
        <CreateRoomModal onClose={() => setShowCreateRoom(false)} onCreate={createRoom} />
      )}
      {showNewDM && (
        <NewDMModal onClose={() => setShowNewDM(false)} onSelect={handleSelectDMUser} onlineIds={onlineIds} />
      )}
      {showCreateVoice && (
        <CreateVoiceChannelModal onClose={() => setShowCreateVoice(false)} onCreate={createVoiceChannel} />
      )}
      {showAudioSettings && (
        <AudioSettings onClose={() => setShowAudioSettings(false)} />
      )}
      {showGuildSettings && (
        <GuildSettingsModal onClose={() => setShowGuildSettings(false)} />
      )}
      {showInviteGuild && (
        <InviteGuildModal onClose={() => setShowInviteGuild(false)} />
      )}
      {profileCard && (
        <UserProfileCard
          userId={profileCard.user.userId}
          username={profileCard.user.username}
          avatarColor={profileCard.user.avatarColor}
          profilePicture={profileCard.user.profilePicture}
          npub={profileCard.user.npub}
          customStatus={profileCard.user.customStatus}
          isOnline={true}
          position={profileCard.position}
          onClose={() => setProfileCard(null)}
          onSendMessage={(u) => {
            handleSelectDMUser({ id: u.userId, username: u.username, avatar_color: u.avatarColor, npub: u.npub || null });
          }}
        />
      )}

    </div>
  );
}


