import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GUILD_SETTINGS_PERMISSION_GROUPS,
  GUILD_SETTINGS_PERMISSION_LABELS,
  deriveGuildSettingsCapabilities,
  getVisibleGuildSettingsTabs,
  validateGuildSettingsImageFile,
} from '../../../client/src/features/guild/guildSettingsModel.mjs';

test('guild settings model validates guild image uploads with the shared constraints', () => {
  assert.deepEqual(validateGuildSettingsImageFile(null), {
    ok: false,
    error: 'No image selected',
  });

  assert.deepEqual(validateGuildSettingsImageFile({
    name: 'banner.gif',
    type: 'image/gif',
    size: 1024,
  }), {
    ok: false,
    error: 'Guild images must be JPG or PNG',
  });

  assert.deepEqual(validateGuildSettingsImageFile({
    name: 'banner.png',
    type: 'image/png',
    size: 6 * 1024 * 1024,
  }), {
    ok: false,
    error: 'Image must be less than 5MB',
  });

  assert.deepEqual(validateGuildSettingsImageFile({
    name: 'banner.png',
    type: 'image/png',
    size: 1024,
  }), {
    ok: true,
  });
});

test('guild settings model derives the canonical guild capability flags from member capabilities', () => {
  const derived = deriveGuildSettingsCapabilities({
    rankOrder: 2,
    effectivePermissions: {
      invite_member: true,
      modify_motd: true,
      manage_theme: false,
      remove_member: false,
      promote_demote: true,
      set_permissions: false,
    },
  });

  assert.equal(derived.isGuildMaster, false);
  assert.equal(derived.canInvite, true);
  assert.equal(derived.canModifyMotd, true);
  assert.equal(derived.canPromoteDemote, true);
  assert.equal(derived.canSetPerms, false);
  assert.equal(derived.showMemberControls, true);
  assert.equal(derived.readOnly, false);
});

test('guild settings model exposes the canonical tab set and permission group map', () => {
  assert.deepEqual(getVisibleGuildSettingsTabs({
    canInvite: false,
    canSetPerms: false,
    isGuildMaster: false,
  }), ['Overview', 'Members']);

  assert.deepEqual(getVisibleGuildSettingsTabs({
    canInvite: true,
    canSetPerms: true,
    isGuildMaster: true,
  }), ['Overview', 'Members', 'Ranks', 'Invite', 'Admin']);

  assert.equal(GUILD_SETTINGS_PERMISSION_GROUPS.Administration.includes('set_permissions'), true);
  assert.equal(GUILD_SETTINGS_PERMISSION_LABELS.manage_theme, 'Manage Theme');
});
