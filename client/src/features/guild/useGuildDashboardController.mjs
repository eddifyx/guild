import { useAuth } from '../../contexts/AuthContext';
import { useGuild } from '../../contexts/GuildContext';
import { useSocket } from '../../contexts/SocketContext';
import { useGuilds } from '../../hooks/useGuilds';
import { useOnlineUsers } from '../../hooks/useOnlineUsers';
import { useGuildDashboardControllerComposition } from './useGuildDashboardControllerComposition.mjs';
import { useGuildDashboardControllerState } from './useGuildDashboardControllerState.mjs';
import { useGuildDashboardControllerViewState } from './useGuildDashboardControllerViewState.mjs';

export function useGuildDashboardController({
  onSelectDM,
  onRosterViewChange,
} = {}) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { currentGuild, currentGuildData } = useGuild();
  const { fetchMembers } = useGuilds();
  const { onlineUsers, onlineIds } = useOnlineUsers();

  const state = useGuildDashboardControllerState();
  const viewState = useGuildDashboardControllerViewState({
    members: state.members,
    onlineUsers,
    onlineIds,
    showOffline: state.showOffline,
    showExpandedRoster: state.showExpandedRoster,
    currentGuildData,
    guildImgFailed: state.guildImgFailed,
    editingStatus: state.editingStatus,
    statusDraft: state.statusDraft,
    myStatus: state.myStatus,
  });
  const composition = useGuildDashboardControllerComposition({
    socket,
    currentGuild,
    currentUserId: user?.userId,
    onlineUsers,
    fetchMembers,
    onSelectDM,
    onRosterViewChange,
    state,
    viewState,
  });

  return {
    currentUserId: user?.userId,
    members: state.members,
    myStatus: state.myStatus,
    editingStatus: state.editingStatus,
    displayedStatusDraft: viewState.displayedStatusDraft,
    showOffline: state.showOffline,
    showAbout: state.showAbout,
    profileCard: state.profileCard,
    statusPopover: state.statusPopover,
    statusInputRef: state.statusInputRef,
    headerState: viewState.headerState,
    rosterState: viewState.rosterState,
    formatLastSeen: viewState.formatLastSeen,
    ...composition,
  };
}
