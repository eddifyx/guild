export function syncVoiceChannelAdminState({
  voiceChannels = [],
  channelContextMenu = null,
  renameModal = null,
  deleteConfirm = null,
  setChannelContextMenuFn = () => {},
  setRenameModalFn = () => {},
  setRenameDraftFn = () => {},
  setRenameErrorFn = () => {},
  setDeleteConfirmFn = () => {},
  setDeleteErrorFn = () => {},
} = {}) {
  const hasChannel = (channelId) => voiceChannels.some((channel) => channel.id === channelId);

  if (channelContextMenu && !hasChannel(channelContextMenu.channel?.id)) {
    setChannelContextMenuFn(null);
  }
  if (renameModal && !hasChannel(renameModal.id)) {
    setRenameModalFn(null);
    setRenameDraftFn('');
    setRenameErrorFn('');
  }
  if (deleteConfirm && !hasChannel(deleteConfirm.id)) {
    setDeleteConfirmFn(null);
    setDeleteErrorFn('');
  }
}

export function createVoiceChannelAdminHandlers({
  renameVoiceChannelFn = async () => {},
  deleteVoiceChannelFn = async () => {},
  setVolumeMenuFn = () => {},
  setChannelContextMenuFn = () => {},
  setRenameModalFn = () => {},
  setRenameDraftFn = () => {},
  setRenameErrorFn = () => {},
  setRenamingFn = () => {},
  setDeleteConfirmFn = () => {},
  setDeleteErrorFn = () => {},
} = {}) {
  return {
    openChannelContextMenu(event, channel, canManageChannel) {
      if (!canManageChannel) {
        return;
      }
      event.preventDefault();
      setVolumeMenuFn(null);
      setChannelContextMenuFn({
        x: event.clientX,
        y: event.clientY,
        channel,
      });
    },

    openRenameModal(channel) {
      setRenameDraftFn(channel.name);
      setRenameErrorFn('');
      setRenameModalFn({ id: channel.id, name: channel.name });
      setChannelContextMenuFn(null);
    },

    closeRenameModal({ renaming = false } = {}) {
      if (renaming) {
        return;
      }
      setRenameModalFn(null);
      setRenameDraftFn('');
      setRenameErrorFn('');
    },

    async submitRenameChannel({
      renameModal,
      renameDraft,
      renaming = false,
    } = {}) {
      const nextName = renameDraft?.trim?.() || '';
      if (!renameModal || !nextName || nextName === renameModal.name || renaming) {
        return false;
      }
      try {
        setRenamingFn(true);
        await renameVoiceChannelFn(renameModal.id, nextName);
        setRenameModalFn(null);
        setRenameDraftFn('');
        setRenameErrorFn('');
        return true;
      } catch (error) {
        setRenameErrorFn(error?.message || 'Failed to rename voice channel.');
        return false;
      } finally {
        setRenamingFn(false);
      }
    },

    openDeleteConfirm(channel) {
      setDeleteErrorFn('');
      setDeleteConfirmFn({ id: channel.id, name: channel.name });
      setChannelContextMenuFn(null);
    },

    closeDeleteConfirm() {
      setDeleteConfirmFn(null);
      setDeleteErrorFn('');
    },

    async submitDeleteChannel(deleteConfirm) {
      if (!deleteConfirm) {
        return false;
      }
      try {
        await deleteVoiceChannelFn(deleteConfirm.id);
        setDeleteConfirmFn(null);
        setDeleteErrorFn('');
        return true;
      } catch (error) {
        setDeleteErrorFn(error?.message || 'Failed to delete voice channel.');
        return false;
      }
    },
  };
}
