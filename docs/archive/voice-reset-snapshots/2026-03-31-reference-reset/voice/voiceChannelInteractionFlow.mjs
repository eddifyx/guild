import {
  findActiveVoiceStreamParticipant,
  getStoredUserVolumePercent,
  toggleMutedUserPreference,
  unmuteUserForVolumeAdjustment,
} from './voiceChannelListModel.mjs';

export function syncVoiceChannelInteractionState({
  voiceChannels = [],
  volumeMenu = null,
  setVolumeMenuFn = () => {},
} = {}) {
  if (!volumeMenu?.userId) {
    return;
  }

  const userStillPresent = voiceChannels.some((channel) =>
    (channel?.participants || []).some((participant) => participant.userId === volumeMenu.userId)
  );

  if (!userStillPresent) {
    setVolumeMenuFn(null);
  }
}

export function createVoiceChannelInteractionHandlers({
  joinChannelFn = () => {},
  onSelectStreamFn = null,
  onSelectVoiceChannelFn = null,
  setVolumeMenuFn = () => {},
  setVolumesFn = () => {},
  setMutedUsersFn = () => {},
  setUserVolumeFn = () => {},
  mutedUsers = {},
  volumes = {},
  storage = globalThis.localStorage,
} = {}) {
  return {
    handleChannelActivate({
      channel,
      isActive = false,
      participants = [],
      participantStateOptions = {},
    } = {}) {
      if (!channel?.id) {
        return;
      }

      if (!isActive) {
        joinChannelFn(channel.id);
        return;
      }

      const streamer = findActiveVoiceStreamParticipant(participants, participantStateOptions);
      if (streamer && onSelectStreamFn) {
        onSelectStreamFn(streamer.userId, streamer.username);
        return;
      }
      if (onSelectVoiceChannelFn) {
        onSelectVoiceChannelFn(channel.id, channel.name);
      }
    },

    openParticipantVolumeMenu(event, participant, currentUserId) {
      if (!participant?.userId || participant.userId === currentUserId) {
        return;
      }
      event.preventDefault();
      setVolumeMenuFn({
        x: event.clientX,
        y: event.clientY,
        userId: participant.userId,
        username: participant.username,
      });
    },

    closeVolumeMenu() {
      setVolumeMenuFn(null);
    },

    getUserVolume(userId) {
      return getStoredUserVolumePercent(userId, { volumes, storage });
    },

    handleVolumeChange(userId, value) {
      const nextVolume = parseInt(value, 10);
      setVolumesFn((prev) => ({ ...prev, [userId]: nextVolume }));
      setUserVolumeFn(userId, nextVolume / 100);
      return nextVolume;
    },

    toggleUserMute(userId) {
      setMutedUsersFn((prev) => {
        const { nextMutedUsers, nextVolumeRatio } = toggleMutedUserPreference(userId, {
          mutedUsers: prev,
          volumes,
          storage,
        });
        storage?.setItem?.('voice:mutedUsers', JSON.stringify(nextMutedUsers));
        setUserVolumeFn(userId, nextVolumeRatio);
        return nextMutedUsers;
      });
    },

    handleVolumeMenuChange(userId, value) {
      if (mutedUsers[userId]) {
        setMutedUsersFn((prev) => {
          const nextMutedUsers = unmuteUserForVolumeAdjustment(userId, prev);
          storage?.setItem?.('voice:mutedUsers', JSON.stringify(nextMutedUsers));
          return nextMutedUsers;
        });
      }
      this.handleVolumeChange(userId, value);
    },
  };
}
