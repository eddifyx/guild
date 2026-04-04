import { getGuildMemberCapabilities } from './capabilities.js';

export const GUILD_SETTINGS_PERMISSION_LABELS = {
  invite_member: 'Invite Member',
  remove_member: 'Remove Member',
  promote_demote: 'Promote / Demote',
  manage_applications: 'Manage Applications',
  officer_chat: 'Officer Chat',
  modify_motd: 'Modify MotD',
  create_delete_events: 'Create / Delete Events',
  edit_public_note: 'Edit Public Note',
  edit_officer_note: 'Edit Officer Note',
  view_officer_note: 'View Officer Note',
  view_asset_dump: 'View Asset Dump',
  upload_files: 'Upload Files',
  download_files: 'Download Files',
  delete_files: 'Delete Files',
  manage_storage: 'Manage Storage',
  modify_rank_names: 'Modify Rank Names',
  set_permissions: 'Set Permissions',
  manage_rooms: 'Manage Rooms',
  manage_theme: 'Manage Theme',
};

export const GUILD_SETTINGS_PERMISSION_GROUPS = {
  Membership: ['invite_member', 'remove_member', 'promote_demote', 'manage_applications'],
  Communication: ['officer_chat', 'modify_motd'],
  'Events & Content': ['create_delete_events', 'edit_public_note', 'edit_officer_note', 'view_officer_note'],
  'Asset Dump': ['view_asset_dump', 'upload_files', 'download_files', 'delete_files', 'manage_storage'],
  Administration: ['modify_rank_names', 'set_permissions', 'manage_rooms', 'manage_theme'],
};

export function validateGuildSettingsImageFile(file) {
  if (!file) {
    return { ok: false, error: 'No image selected' };
  }

  const normalizedName = (file.name || '').toLowerCase();
  const allowedTypes = new Set(['image/jpeg', 'image/png']);
  const hasAllowedExtension = normalizedName.endsWith('.jpg')
    || normalizedName.endsWith('.jpeg')
    || normalizedName.endsWith('.png');

  if (!allowedTypes.has(file.type) && !hasAllowedExtension) {
    return { ok: false, error: 'Guild images must be JPG or PNG' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: 'Image must be less than 5MB' };
  }

  return { ok: true };
}

export function deriveGuildSettingsCapabilities(member) {
  const capabilities = getGuildMemberCapabilities(member);
  const isGuildMaster = member?.rankOrder === 0;
  const canManageTheme = isGuildMaster || capabilities.canManageTheme;
  const canSetPerms = isGuildMaster || capabilities.canSetPermissions;
  const canInvite = isGuildMaster || capabilities.canInviteMember;
  const canRemoveMember = isGuildMaster || capabilities.canRemoveMember;
  const canPromoteDemote = isGuildMaster || capabilities.canPromoteDemote;
  const canEditGuild = isGuildMaster || canManageTheme;
  const canModifyMotd = isGuildMaster || capabilities.canModifyMotd;
  const readOnly = !canEditGuild && !canModifyMotd;
  const showMemberControls = canRemoveMember || canPromoteDemote;

  return {
    isGuildMaster,
    capabilities,
    canManageTheme,
    canSetPerms,
    canInvite,
    canRemoveMember,
    canPromoteDemote,
    canEditGuild,
    canModifyMotd,
    readOnly,
    showMemberControls,
  };
}

export function getVisibleGuildSettingsTabs({
  canInvite = false,
  canSetPerms = false,
  isGuildMaster = false,
} = {}) {
  const nextTabs = ['Overview', 'Members'];
  if (canSetPerms) nextTabs.push('Ranks');
  if (canInvite) nextTabs.push('Invite');
  if (isGuildMaster) nextTabs.push('Admin');
  return nextTabs;
}
