import React, { memo, useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useVoiceContext } from '../../contexts/VoiceContext';
import { useGuild } from '../../contexts/GuildContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { api, getFileUrl } from '../../api';
import DMList from '../DirectMessages/DMList';
import VoiceChannelList from '../Voice/VoiceChannelList';
import VoiceControls from '../Voice/VoiceControls';
import { rememberUserNpub, rememberUsers, trustUserNpub } from '../../crypto/identityDirectory.js';
import { startPerfTrace } from '../../utils/devPerf';
import { confirmLogout } from '../../utils/confirmLogout';
import {
  readNotificationMutePreferences,
  setGlobalNotificationsMuted,
} from '../../features/messaging/notificationPolicy';
import {
  buildSidebarGuildHeaderState,
  canSidebarManageRooms,
  mergeSidebarDmConversationMeta,
  resolveSidebarDmUserMeta,
} from '../../features/layout/sidebarModel.mjs';
import {
  appendSidebarDmConversation,
  fetchSidebarDmConversations,
  removeSidebarDmConversation,
} from '../../features/layout/sidebarDmRuntime.mjs';
import {
  closeSidebarTracedModal,
  openSidebarTracedModal,
} from '../../features/layout/sidebarControllerRuntime.mjs';
import {
  removeSidebarDmConversationFlow,
  selectSidebarDmUser,
} from '../../features/layout/sidebarActionsRuntime.mjs';
import { useSidebarRuntimeEffects } from '../../features/layout/useSidebarRuntimeEffects.mjs';
import {
  SidebarAssetSection,
  SIDEBAR_GEAR_ICON,
  SidebarGuildHeader,
  SidebarIconButton,
  SidebarModalDeck,
  SidebarOnlineUsersSection,
  SIDEBAR_PLUS_ICON,
  SidebarSectionHeader,
  SidebarUserBar,
} from './SidebarPanels.jsx';

function Sidebar({ rooms, myRooms, createRoom, joinRoom, renameRoom, deleteRoom, conversation, onSelectRoom, onSelectDM, onSelectAssetDump, onSelectAddons, onSelectStream, onSelectNostrProfile, onSelectVoiceChannel, onSelectTavern, guildChatMentionUnread = false, unreadCounts, unreadRoomCounts }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { onlineUsers, onlineIds } = useOnlineUsers();
  const { createVoiceChannel, voiceChannels } = useVoiceContext();
  const { currentGuild, currentGuildData } = useGuild();
  const [dmConversations, setDMConversations] = useState([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const [showCreateVoice, setShowCreateVoice] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showGuildSettings, setShowGuildSettings] = useState(false);
  const [audioSettingsOpenTraceId, setAudioSettingsOpenTraceId] = useState(null);
  const [guildSettingsOpenTraceId, setGuildSettingsOpenTraceId] = useState(null);
  const [showInviteGuild, setShowInviteGuild] = useState(false);
  const [profileCard, setProfileCard] = useState(null);
  const [sidebarGuildImgFailed, setSidebarGuildImgFailed] = useState(false);
  const [notificationsMuted, setNotificationsMuted] = useState(() => (
    readNotificationMutePreferences().muteAll
  ));
  const closeAudioSettings = useCallback(() => {
    closeSidebarTracedModal({
      setVisibleFn: setShowAudioSettings,
      setOpenTraceIdFn: setAudioSettingsOpenTraceId,
    });
  }, []);
  const closeGuildSettings = useCallback(() => {
    closeSidebarTracedModal({
      setVisibleFn: setShowGuildSettings,
      setOpenTraceIdFn: setGuildSettingsOpenTraceId,
    });
  }, []);
  const toggleNotificationsMuted = useCallback(() => {
    const nextPreferences = setGlobalNotificationsMuted(!notificationsMuted);
    setNotificationsMuted(nextPreferences.muteAll);
  }, [notificationsMuted]);
  const openAudioSettings = useCallback(() => {
    openSidebarTracedModal({
      traceName: 'audio-settings-open',
      startPerfTraceFn: startPerfTrace,
      setOpenTraceIdFn: setAudioSettingsOpenTraceId,
      setVisibleFn: setShowAudioSettings,
    });
  }, []);
  const openGuildSettings = useCallback(() => {
    openSidebarTracedModal({
      traceName: 'guild-settings-open',
      startPerfTraceFn: startPerfTrace,
      setOpenTraceIdFn: setGuildSettingsOpenTraceId,
      setVisibleFn: setShowGuildSettings,
    });
  }, []);

  const guildMembersById = useMemo(() => new Map(
    (currentGuildData?.members || []).map((member) => [member.id, member])
  ), [currentGuildData?.members]);
  const onlineUsersById = useMemo(() => new Map(
    onlineUsers.map((entry) => [entry.userId, entry])
  ), [onlineUsers]);
  const canManageRooms = useMemo(() => canSidebarManageRooms(currentGuildData), [currentGuildData]);

  const resolveDMUserMeta = useCallback((otherUserId, fallback = {}) => {
    return resolveSidebarDmUserMeta({
      guildMembersById,
      onlineUsersById,
      otherUserId,
      fallback,
    });
  }, [guildMembersById, onlineUsersById]);

  const mergeDMConversationMeta = useCallback((conversation, fallback = {}) => {
    const resolved = resolveDMUserMeta(conversation.other_user_id, {
      username: fallback.username || conversation.other_username,
      avatarColor: fallback.avatarColor || conversation.other_avatar_color,
      profilePicture: fallback.profilePicture || conversation.other_profile_picture,
      npub: fallback.npub || conversation.other_npub,
    });
    return mergeSidebarDmConversationMeta({
      conversation,
      resolvedMeta: resolved,
    });
  }, [resolveDMUserMeta]);

  const refreshDmConversations = useCallback(async () => {
    const next = await fetchSidebarDmConversations({
      apiFn: api,
      rememberUsersFn: rememberUsers,
    });
    setDMConversations(next);
  }, []);

  const { socket } = useSocket();
  useSidebarRuntimeEffects({
    onlineUsers,
    rememberUsersFn: rememberUsers,
    currentGuildImageUrl: currentGuildData?.image_url,
    setSidebarGuildImgFailedFn: setSidebarGuildImgFailed,
    setDMConversationsFn: setDMConversations,
    mergeDMConversationMetaFn: mergeDMConversationMeta,
    refreshDmConversationsFn: refreshDmConversations,
    currentGuild,
    socket,
    user,
    rememberUserNpubFn: rememberUserNpub,
    logErrorFn: console.error,
  });

  const handleSelectDMUser = (u) => {
    selectSidebarDmUser({
      user: u,
      setDMConversationsFn: setDMConversations,
      appendSidebarDmConversationFn: appendSidebarDmConversation,
      rememberUserNpubFn: rememberUserNpub,
      trustUserNpubFn: trustUserNpub,
      onSelectDMFn: onSelectDM,
    });
  };

  const guildHeaderState = useMemo(() => buildSidebarGuildHeaderState({
    currentGuildData,
    sidebarGuildImgFailed,
    guildChatMentionUnread,
    conversation,
    getFileUrlFn: getFileUrl,
  }), [conversation, currentGuildData, guildChatMentionUnread, sidebarGuildImgFailed]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncNotificationMuteState = () => {
      setNotificationsMuted(readNotificationMutePreferences().muteAll);
    };

    window.addEventListener('storage', syncNotificationMuteState);
    window.addEventListener('focus', syncNotificationMuteState);
    return () => {
      window.removeEventListener('storage', syncNotificationMuteState);
      window.removeEventListener('focus', syncNotificationMuteState);
    };
  }, []);

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
      <SidebarUserBar
        user={user}
        connected={connected}
        notificationsMuted={notificationsMuted}
        onOpenProfile={onSelectNostrProfile}
        onToggleNotificationsMuted={toggleNotificationsMuted}
        onLogout={() => { void confirmLogout(logout); }}
      />
      <SidebarGuildHeader
        guildHeaderState={guildHeaderState}
        guildChatMentionUnread={guildChatMentionUnread}
        onSelectTavern={onSelectTavern}
        onInvite={() => setShowInviteGuild(true)}
        onOpenGuildSettings={openGuildSettings}
        onGuildImageError={() => setSidebarGuildImgFailed(true)}
      />

      {/* Scrollable sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px', WebkitAppRegion: 'no-drag' }}>
        {/* Voice Channels */}
        <div style={{ marginBottom: 16 }}>
	          <SidebarSectionHeader label="Voice"
              actions={
	            <>
	              <SidebarIconButton onClick={openAudioSettings} title="Audio settings">{SIDEBAR_GEAR_ICON}</SidebarIconButton>
	              <SidebarIconButton onClick={() => setShowCreateVoice(true)} title="Create voice channel">{SIDEBAR_PLUS_ICON}</SidebarIconButton>
	            </>
              }
            />
          <VoiceChannelList onSelectStream={onSelectStream} onSelectVoiceChannel={onSelectVoiceChannel} />
        </div>

        <SidebarAssetSection
          conversation={conversation}
          onSelectAssetDump={() => onSelectAssetDump()}
          onSelectAddons={() => onSelectAddons()}
        />

        {/* DMs */}
        <div style={{ marginBottom: 16 }}>
          <SidebarSectionHeader label="Messages"
            actions={
            <>
              <SidebarIconButton onClick={() => setShowNewDM(true)} title="New DM">{SIDEBAR_PLUS_ICON}</SidebarIconButton>
            </>
          }
          />
          <DMList
            conversations={dmConversations}
            activeId={conversation?.type === 'dm' ? conversation.id : null}
            onSelect={(conv) => onSelectDM(conv)}
            unreadCounts={unreadCounts}
            onRemove={(otherUserId) => {
              removeSidebarDmConversationFlow({
                socket,
                otherUserId,
                setDMConversationsFn: setDMConversations,
                removeSidebarDmConversationFn: removeSidebarDmConversation,
                conversation,
                onSelectRoomFn: onSelectRoom,
              });
            }}
            onlineIds={onlineIds}
          />
        </div>

        <SidebarOnlineUsersSection
          onlineUsers={onlineUsers}
          currentUserId={user?.userId}
          onOpenProfile={(nextUser, event) => {
            setProfileCard({ user: nextUser, position: { x: event.clientX, y: event.clientY } });
          }}
        />
      </div>

      {/* Voice controls */}
      <VoiceControls />

      <SidebarModalDeck
        showCreateRoom={false}
        canManageRooms={canManageRooms}
        createRoom={createRoom}
        showNewDM={showNewDM}
        onSelectDmUser={handleSelectDMUser}
        onlineIds={onlineIds}
        showCreateVoice={showCreateVoice}
        createVoiceChannel={createVoiceChannel}
        showAudioSettings={showAudioSettings}
        closeAudioSettings={closeAudioSettings}
        audioSettingsOpenTraceId={audioSettingsOpenTraceId}
        showGuildSettings={showGuildSettings}
        closeGuildSettings={closeGuildSettings}
        guildSettingsOpenTraceId={guildSettingsOpenTraceId}
        showInviteGuild={showInviteGuild}
        closeInviteGuild={() => setShowInviteGuild(false)}
        profileCard={profileCard}
        closeProfileCard={() => setProfileCard(null)}
        onSendProfileMessage={(profileUser) => {
          handleSelectDMUser({ id: profileUser.userId, username: profileUser.username, avatar_color: profileUser.avatarColor, npub: profileUser.npub || null });
        }}
        closeCreateRoom={() => {}}
        closeNewDm={() => setShowNewDM(false)}
        closeCreateVoice={() => setShowCreateVoice(false)}
      />

    </div>
  );
}

export default memo(Sidebar);
