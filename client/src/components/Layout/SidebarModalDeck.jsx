import React from 'react';
import AudioSettings from '../Voice/AudioSettings';
import CreateRoomModal from '../Rooms/CreateRoomModal';
import NewDMModal from '../DirectMessages/NewDMModal';
import CreateVoiceChannelModal from '../Voice/CreateVoiceChannelModal';
import GuildSettingsModal from '../Guild/GuildSettingsModal';
import InviteGuildModal from '../Guild/InviteGuildModal';
import UserProfileCard from '../Common/UserProfileCard';

export default function SidebarModalDeck({
  showCreateRoom = false,
  canManageRooms = false,
  createRoom = () => {},
  showNewDM = false,
  onSelectDmUser = () => {},
  onlineIds = new Set(),
  showCreateVoice = false,
  createVoiceChannel = () => {},
  showAudioSettings = false,
  closeAudioSettings = () => {},
  audioSettingsOpenTraceId = null,
  showGuildSettings = false,
  closeGuildSettings = () => {},
  guildSettingsOpenTraceId = null,
  showInviteGuild = false,
  closeInviteGuild = () => {},
  profileCard = null,
  closeProfileCard = () => {},
  onSendProfileMessage = () => {},
  closeCreateRoom = () => {},
  closeNewDm = () => {},
  closeCreateVoice = () => {},
} = {}) {
  return (
    <>
      {showCreateRoom && canManageRooms && (
        <CreateRoomModal onClose={closeCreateRoom} onCreate={createRoom} />
      )}
      {showNewDM && (
        <NewDMModal onClose={closeNewDm} onSelect={onSelectDmUser} onlineIds={onlineIds} />
      )}
      {showCreateVoice && canManageRooms && (
        <CreateVoiceChannelModal onClose={closeCreateVoice} onCreate={createVoiceChannel} />
      )}
      {showAudioSettings && (
        <AudioSettings onClose={closeAudioSettings} openTraceId={audioSettingsOpenTraceId} />
      )}
      {showGuildSettings && (
        <GuildSettingsModal onClose={closeGuildSettings} openTraceId={guildSettingsOpenTraceId} />
      )}
      {showInviteGuild && (
        <InviteGuildModal onClose={closeInviteGuild} />
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
          onClose={closeProfileCard}
          onSendMessage={onSendProfileMessage}
        />
      )}
    </>
  );
}
