import {
  useGuildDashboardControllerRosterActions,
} from './useGuildDashboardControllerRosterActions.mjs';
import {
  useGuildDashboardControllerStatusActions,
} from './useGuildDashboardControllerStatusActions.mjs';

export function useGuildDashboardControllerActions({
  socket = null,
  currentUserId = null,
  onSelectDM,
  state = {},
  viewState = {},
} = {}) {
  const statusActions = useGuildDashboardControllerStatusActions({
    socket,
    currentUserId,
    state,
    viewState,
  });
  const rosterActions = useGuildDashboardControllerRosterActions({
    currentUserId,
    onSelectDM,
    state,
  });

  return {
    ...statusActions,
    ...rosterActions,
  };
}
