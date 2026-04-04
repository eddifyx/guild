import React, { memo, useState, useEffect, useRef, useMemo } from 'react';
import { useVoiceContext, useVoicePresenceContext } from '../../contexts/VoiceContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import {
  buildOnlineUsersById,
  buildProactiveVoiceNotice,
  buildVoiceRecoveryHint,
  parseMutedUsers,
} from '../../features/voice/voiceChannelListModel.mjs';
import {
  createVoiceChannelAdminHandlers,
  syncVoiceChannelAdminState,
} from '../../features/voice/voiceChannelAdminFlow.mjs';
import {
  createVoiceChannelInteractionHandlers,
  syncVoiceChannelInteractionState,
} from '../../features/voice/voiceChannelInteractionFlow.mjs';
import {
  VoiceDeleteChannelModal,
  VoiceJoinErrorNotice,
  VoiceRenameChannelModal,
  VoiceStatusNotice,
} from './VoiceChannelStatusPanels.jsx';
import { VoiceChannelRows } from './VoiceChannelRows.jsx';
import {
  VoiceChannelContextMenu,
  VoiceParticipantVolumeMenu,
} from './VoiceChannelMenus.jsx';

function VoiceChannelList({ onSelectStream, onSelectVoiceChannel }) {
  const { user } = useAuth();
  const { currentGuildData } = useGuild();
  const {
    voiceChannels,
    channelId,
    joinChannel,
    renameVoiceChannel,
    deleteVoiceChannel,
    joinError,
    setUserVolume,
    voiceStatus,
    refreshVoiceStatus,
  } = useVoiceContext();
  const { peers, speaking: selfSpeaking } = useVoicePresenceContext();
  const { onlineUsers } = useOnlineUsers();
  const [volumeMenu, setVolumeMenu] = useState(null); // { x, y, userId, username }
  const [volumes, setVolumes] = useState({}); // { userId: 0-100 }
  const [mutedUsers, setMutedUsers] = useState(() => parseMutedUsers(localStorage.getItem('voice:mutedUsers')));
  const [channelContextMenu, setChannelContextMenu] = useState(null);
  const [renameModal, setRenameModal] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const menuRef = useRef(null);
  const onlineUsersById = useMemo(() => buildOnlineUsersById(onlineUsers), [onlineUsers]);

  // Close menu on outside click
  useEffect(() => {
    if (!volumeMenu && !channelContextMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setVolumeMenu(null);
        setChannelContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [volumeMenu, channelContextMenu]);

  useEffect(() => {
    syncVoiceChannelAdminState({
      voiceChannels,
      channelContextMenu,
      renameModal,
      deleteConfirm,
      setChannelContextMenuFn: setChannelContextMenu,
      setRenameModalFn: setRenameModal,
      setRenameDraftFn: setRenameDraft,
      setRenameErrorFn: setRenameError,
      setDeleteConfirmFn: setDeleteConfirm,
      setDeleteErrorFn: setDeleteError,
    });
  }, [voiceChannels, channelContextMenu, renameModal, deleteConfirm]);

  useEffect(() => {
    syncVoiceChannelInteractionState({
      voiceChannels,
      volumeMenu,
      setVolumeMenuFn: setVolumeMenu,
    });
  }, [voiceChannels, volumeMenu]);

  const channelAdminHandlers = useMemo(() => createVoiceChannelAdminHandlers({
    renameVoiceChannelFn: renameVoiceChannel,
    deleteVoiceChannelFn: deleteVoiceChannel,
    setVolumeMenuFn: setVolumeMenu,
    setChannelContextMenuFn: setChannelContextMenu,
    setRenameModalFn: setRenameModal,
    setRenameDraftFn: setRenameDraft,
    setRenameErrorFn: setRenameError,
    setRenamingFn: setRenaming,
    setDeleteConfirmFn: setDeleteConfirm,
    setDeleteErrorFn: setDeleteError,
  }), [renameVoiceChannel, deleteVoiceChannel]);
  const channelInteractionHandlers = useMemo(() => createVoiceChannelInteractionHandlers({
    joinChannelFn: joinChannel,
    onSelectStreamFn: onSelectStream,
    onSelectVoiceChannelFn: onSelectVoiceChannel,
    setVolumeMenuFn: setVolumeMenu,
    setVolumesFn: setVolumes,
    setMutedUsersFn: setMutedUsers,
    setUserVolumeFn: setUserVolume,
    mutedUsers,
    volumes,
  }), [joinChannel, onSelectStream, onSelectVoiceChannel, setUserVolume, mutedUsers, volumes]);

  const voiceRecoveryHint = useMemo(() => buildVoiceRecoveryHint(joinError), [joinError]);
  const showVoiceRecoveryState = !!voiceRecoveryHint;
  const proactiveVoiceNotice = useMemo(() => buildProactiveVoiceNotice(voiceStatus), [voiceStatus]);

  return (
    <div>
      <VoiceStatusNotice
        proactiveVoiceNotice={proactiveVoiceNotice}
        showVoiceRecoveryState={showVoiceRecoveryState}
        refreshVoiceStatus={refreshVoiceStatus}
      />

      <VoiceChannelRows
        voiceChannels={voiceChannels}
        channelId={channelId}
        currentUserId={user.userId}
        myRankOrder={currentGuildData?.myRank?.order ?? null}
        onlineUsersById={onlineUsersById}
        selfSpeaking={selfSpeaking}
        peers={peers}
        onChannelActivate={(payload) => {
          channelInteractionHandlers.handleChannelActivate(payload);
        }}
        onChannelContextMenu={(event, channel, canDeleteChannel) => {
          channelAdminHandlers.openChannelContextMenu(event, channel, canDeleteChannel);
        }}
        onParticipantContextMenu={(event, participant, currentUserId) => {
          channelInteractionHandlers.openParticipantVolumeMenu(event, participant, currentUserId);
        }}
      />

      {/* Join error message */}
      <VoiceJoinErrorNotice
        joinError={joinError}
        showVoiceRecoveryState={showVoiceRecoveryState}
        voiceRecoveryHint={voiceRecoveryHint}
      />

      <VoiceRenameChannelModal
        renameModal={renameModal}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        renameError={renameError}
        setRenameError={setRenameError}
        renaming={renaming}
        channelAdminHandlers={channelAdminHandlers}
      />

      <VoiceDeleteChannelModal
        deleteConfirm={deleteConfirm}
        deleteError={deleteError}
        channelAdminHandlers={channelAdminHandlers}
      />

      <VoiceChannelContextMenu
        channelContextMenu={channelContextMenu}
        menuRef={menuRef}
        channelAdminHandlers={channelAdminHandlers}
      />

      <VoiceParticipantVolumeMenu
        volumeMenu={volumeMenu}
        mutedUsers={mutedUsers}
        menuRef={menuRef}
        channelInteractionHandlers={channelInteractionHandlers}
      />
    </div>
  );
}

export default memo(VoiceChannelList);
