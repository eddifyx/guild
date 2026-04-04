import { buildGuildDashboardStatusSubmit } from './guildDashboardControllerModel.mjs';
import { buildGuildDashboardStatusPopover } from './guildDashboardModel.mjs';

export function useGuildDashboardControllerStatusActions({
  socket = null,
  currentUserId = null,
  state = {},
  viewState = {},
} = {}) {
  const {
    setMyStatus = () => {},
    statusDraft = '',
    myStatus = '',
    setStatusDraft = () => {},
    setEditingStatus = () => {},
    setProfileCard = () => {},
    setStatusPopover = () => {},
  } = state;

  const {
    maxStatusLength = 80,
  } = viewState;

  const handleStatusSubmit = () => {
    const nextStatus = buildGuildDashboardStatusSubmit({
      statusDraft,
      maxLength: maxStatusLength,
    });
    socket?.emit('status:update', { status: nextStatus });
    setMyStatus(nextStatus);
    setEditingStatus(false);
  };

  const handleStatusKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleStatusSubmit();
    }
    if (event.key === 'Escape') {
      setEditingStatus(false);
    }
  };

  return {
    onStatusDraftChange: setStatusDraft,
    onStartEditingStatus: () => {
      setStatusDraft(myStatus);
      setEditingStatus(true);
    },
    onStatusKeyDown: handleStatusKeyDown,
    onStatusSubmit: handleStatusSubmit,
    onOpenStatus: (member, event) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const nextPopover = buildGuildDashboardStatusPopover({
        member,
        rect,
        currentUserId,
      });
      if (!nextPopover) return;
      setProfileCard(null);
      setStatusPopover(nextPopover);
    },
    onCloseStatusPopover: () => setStatusPopover(null),
  };
}
