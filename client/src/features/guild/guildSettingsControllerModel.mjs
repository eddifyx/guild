import {
  deriveGuildSettingsCapabilities,
  getVisibleGuildSettingsTabs,
} from './guildSettingsModel.mjs';

export function buildGuildSettingsMemberState({
  members = [],
  userId = null,
} = {}) {
  const myMember = members.find((member) => member.id === userId) || null;
  const myRankOrder = myMember?.rankOrder ?? 999;

  return {
    myMember,
    myRankOrder,
    isGuildMaster: myRankOrder === 0,
  };
}

export function buildGuildSettingsShellState({
  permissionsReady = false,
  myMember = null,
} = {}) {
  const capabilities = deriveGuildSettingsCapabilities(myMember);
  const visibleTabs = getVisibleGuildSettingsTabs({
    canInvite: capabilities.canInvite,
    canSetPerms: capabilities.canSetPerms,
    isGuildMaster: capabilities.isGuildMaster,
  });

  return {
    permissionsReady,
    ...capabilities,
    visibleTabs,
    title: !permissionsReady
      ? 'Loading...'
      : capabilities.readOnly
        ? 'Guild Info'
        : 'Guild Settings',
    showLeaveFooter: permissionsReady && !capabilities.isGuildMaster,
  };
}
