import { validateGuildSettingsImageFile } from './guildSettingsModel.mjs';

function replaceImagePreview({
  nextUrl = null,
  setImagePreviewFn = () => {},
  revokeObjectUrlFn = () => {},
}) {
  setImagePreviewFn((previousPreview) => {
    if (typeof previousPreview === 'string' && previousPreview.startsWith('blob:')) {
      revokeObjectUrlFn(previousPreview);
    }
    return nextUrl;
  });
}

export function createGuildSettingsControllerActions({
  currentGuild = null,
  currentGuildName = '',
  guildName = '',
  guildDesc = '',
  guildPublic = false,
  guildImage = '',
  motd = '',
  newRankName = '',
  transferTarget = '',
  members = [],
  confirmDialog = null,
  flash = () => {},
  onClose = () => {},
  deps = {},
  state = {},
} = {}) {
  const {
    updateGuildFn = async () => {},
    fetchGuildDetailsFn = async () => {},
    updateMotdFn = async () => {},
    uploadGuildImageFileFn = async () => ({ fileUrl: '' }),
    createObjectUrlFn = () => '',
    revokeObjectUrlFn = () => {},
    changeMemberRankFn = async () => {},
    kickMemberFn = async () => {},
    createRankFn = async () => {},
    updateRankFn = async () => {},
    deleteRankFn = async () => {},
    regenerateInviteFn = async () => '',
    transferLeadershipFn = async () => {},
    disbandGuildFn = async () => {},
    leaveGuildFn = async () => {},
    loadMembersFn = async () => {},
    loadRanksFn = async () => {},
    clearGuildFn = () => {},
  } = deps;

  const {
    setMotdLoadedFn = () => {},
    setUploadingImageFn = () => {},
    setGuildImageFn = () => {},
    setImagePreviewFn = () => {},
    setMembersFn = () => {},
    setConfirmDialogFn = () => {},
    setNewRankNameFn = () => {},
    setInviteCodeFn = () => {},
    setInviteLoadedFn = () => {},
  } = state;

  return {
    onSaveOverview: async () => {
      try {
        await updateGuildFn(currentGuild, {
          name: guildName,
          description: guildDesc,
          is_public: guildPublic,
          image_url: guildImage,
        });
        await fetchGuildDetailsFn(currentGuild);
        flash('Guild updated', false);
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      }
    },

    onSaveMotd: async () => {
      try {
        await updateMotdFn(currentGuild, motd);
        setMotdLoadedFn(true);
        flash('MotD updated', false);
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      }
    },

    onImageSelect: async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      const validation = validateGuildSettingsImageFile(file);
      if (!validation.ok) {
        flash(validation.error, true);
        return;
      }

      try {
        setUploadingImageFn(true);
        const { fileUrl } = await uploadGuildImageFileFn(file);
        setGuildImageFn(fileUrl);
        replaceImagePreview({
          nextUrl: createObjectUrlFn(file),
          setImagePreviewFn,
          revokeObjectUrlFn,
        });
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      } finally {
        setUploadingImageFn(false);
      }
    },

    onRemoveImage: () => {
      setGuildImageFn('');
      replaceImagePreview({
        nextUrl: null,
        setImagePreviewFn,
        revokeObjectUrlFn,
      });
    },

    onChangeRank: async (userId, rankId) => {
      try {
        await changeMemberRankFn(currentGuild, userId, rankId);
        await loadMembersFn({ force: true });
        flash('Rank updated', false);
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      }
    },

    onKick: (userId, username) => {
      setConfirmDialogFn({
        title: 'Kick Member',
        message: `Remove ${username} from the guild?`,
        danger: true,
        confirmLabel: 'Kick',
        onConfirm: async () => {
          try {
            await kickMemberFn(currentGuild, userId);
            setMembersFn((previousMembers) => previousMembers.filter((member) => member.id !== userId));
            flash('Member removed', false);
          } catch (runtimeError) {
            flash(runtimeError.message, true);
          }
        },
      });
    },

    onCreateRank: async () => {
      if (!newRankName.trim()) {
        return;
      }
      try {
        await createRankFn(currentGuild, { name: newRankName.trim(), permissions: {} });
        await loadRanksFn({ force: true });
        setNewRankNameFn('');
        flash('Rank created', false);
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      }
    },

    onUpdateRank: async (rankId, updates) => {
      try {
        await updateRankFn(currentGuild, rankId, updates);
        await loadRanksFn({ force: true });
        flash('Rank updated', false);
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      }
    },

    onDeleteRank: (rankId, rankName) => {
      setConfirmDialogFn({
        title: 'Delete Rank',
        message: `Delete rank "${rankName}"? Members with this rank will be reassigned.`,
        danger: true,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          try {
            await deleteRankFn(currentGuild, rankId);
            await Promise.all([
              loadRanksFn({ force: true }),
              loadMembersFn({ force: true }),
            ]);
            flash('Rank deleted', false);
          } catch (runtimeError) {
            flash(runtimeError.message, true);
          }
        },
      });
    },

    onRegenerateInvite: async () => {
      try {
        const code = await regenerateInviteFn(currentGuild);
        setInviteCodeFn(code);
        setInviteLoadedFn(true);
        flash('Invite code regenerated', false);
      } catch (runtimeError) {
        flash(runtimeError.message, true);
      }
    },

    onTransfer: () => {
      if (!transferTarget) {
        return;
      }
      const targetMember = members.find((member) => member.id === transferTarget);
      setConfirmDialogFn({
        title: 'Transfer Leadership',
        message: `Transfer Guild Master to ${targetMember?.username || 'this member'}? This cannot be undone.`,
        danger: true,
        confirmLabel: 'Transfer',
        onConfirm: async () => {
          try {
            await transferLeadershipFn(currentGuild, transferTarget);
            await fetchGuildDetailsFn(currentGuild);
            await loadMembersFn({ force: true });
            flash('Leadership transferred', false);
          } catch (runtimeError) {
            flash(runtimeError.message, true);
          }
        },
      });
    },

    onDisband: () => {
      setConfirmDialogFn({
        title: 'Disband Guild',
        message: 'PERMANENTLY delete this guild? All rooms, channels, and members will be lost.',
        danger: true,
        confirmLabel: 'Disband',
        onConfirm: () => {
          setConfirmDialogFn({
            title: 'Final Confirmation',
            message: 'Are you absolutely sure? This cannot be undone.',
            danger: true,
            confirmLabel: 'Yes, Disband',
            onConfirm: async () => {
              try {
                await disbandGuildFn(currentGuild);
                clearGuildFn();
                onClose();
              } catch (runtimeError) {
                flash(runtimeError.message, true);
              }
            },
          });
        },
      });
    },

    onLeaveGuild: () => {
      setConfirmDialogFn({
        title: 'Leave Guild',
        message: `Leave ${currentGuildName || 'this guild'}? You'll need to join or create a new guild.`,
        danger: false,
        confirmLabel: 'Leave',
        onConfirm: async () => {
          try {
            await leaveGuildFn(currentGuild);
            clearGuildFn();
            onClose();
          } catch (runtimeError) {
            flash(runtimeError.message, true);
          }
        },
      });
    },

    onDismissConfirmDialog: () => {
      setConfirmDialogFn(null);
    },

    onAcceptConfirmDialog: () => {
      const callback = confirmDialog?.onConfirm;
      setConfirmDialogFn(null);
      callback?.();
    },
  };
}
