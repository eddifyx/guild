import { useGuildDashboardControllerActions } from './useGuildDashboardControllerActions.mjs';
import { useGuildDashboardControllerEffects } from './useGuildDashboardControllerEffects.mjs';

export function useGuildDashboardControllerComposition({
  socket = null,
  currentGuild = null,
  currentUserId = null,
  onlineUsers = [],
  fetchMembers = async () => [],
  onSelectDM,
  onRosterViewChange,
  state = {},
  viewState = {},
} = {}) {
  useGuildDashboardControllerEffects({
    currentGuild,
    fetchMembers,
    setMembers: state.setMembers,
    onlineUsers,
    currentUserId,
    setMyStatus: state.setMyStatus,
    editingStatus: state.editingStatus,
    statusInputRef: state.statusInputRef,
    onRosterViewChange,
    isRosterExpanded: viewState.rosterState?.isRosterExpanded,
    setShowExpandedRoster: state.setShowExpandedRoster,
    setShowOffline: state.setShowOffline,
    headerImage: viewState.headerState?.guildImage,
    setGuildImgFailed: state.setGuildImgFailed,
  });

  return useGuildDashboardControllerActions({
    socket,
    currentUserId,
    onSelectDM,
    state,
    viewState,
  });
}
