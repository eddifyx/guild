import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useGuilds } from '../../hooks/useGuilds';
import { endPerfTraceAfterNextPaint, startPerfTrace } from '../../utils/devPerf';
import { useGuildSettingsControllerComposition } from './useGuildSettingsControllerComposition.mjs';
import { useGuildSettingsControllerDerivedState } from './useGuildSettingsControllerDerivedState.mjs';
import { useGuildSettingsControllerState } from './useGuildSettingsControllerState.mjs';

export function useGuildSettingsController({
  onClose = () => {},
  openTraceId = null,
} = {}) {
  const { user } = useAuth();
  const { currentGuild, currentGuildData, fetchGuildDetails, clearGuild } = useGuild();
  const {
    updateGuild,
    disbandGuild,
    transferLeadership,
    getInviteCode,
    regenerateInvite,
    fetchMembers,
    changeMemberRank,
    kickMember,
    fetchRanks,
    createRank,
    updateRank,
    deleteRank,
    getMotd,
    updateMotd,
    updateMemberPermissions,
    leaveGuild,
  } = useGuilds();

  const state = useGuildSettingsControllerState({
    currentGuildData,
  });

  const derived = useGuildSettingsControllerDerivedState({
    members: state.members,
    membersLoaded: state.membersLoaded,
    userId: user?.userId,
  });

  return useGuildSettingsControllerComposition({
    currentGuild,
    currentGuildData,
    userId: user?.userId,
    openTraceId,
    onClose,
    state,
    derived,
    deps: {
      fetchGuildDetailsFn: fetchGuildDetails,
      clearGuildFn: clearGuild,
      updateGuildFn: updateGuild,
      disbandGuildFn: disbandGuild,
      transferLeadershipFn: transferLeadership,
      getInviteCodeFn: getInviteCode,
      regenerateInviteFn: regenerateInvite,
      fetchMembersFn: fetchMembers,
      changeMemberRankFn: changeMemberRank,
      kickMemberFn: kickMember,
      fetchRanksFn: fetchRanks,
      createRankFn: createRank,
      updateRankFn: updateRank,
      deleteRankFn: deleteRank,
      getMotdFn: getMotd,
      updateMotdFn: updateMotd,
      updateMemberPermissionsFn: updateMemberPermissions,
      leaveGuildFn: leaveGuild,
      endPerfTraceAfterNextPaintFn: endPerfTraceAfterNextPaint,
    },
  });
}
