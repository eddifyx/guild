import { buildGuildDashboardProfileCardPayload } from './guildDashboardControllerModel.mjs';

export function useGuildDashboardControllerRosterActions({
  currentUserId = null,
  onSelectDM,
  state = {},
} = {}) {
  const {
    setShowExpandedRoster = () => {},
    setShowOffline = () => {},
    setShowAbout = () => {},
    setProfileCard = () => {},
    setStatusPopover = () => {},
    setGuildImgFailed = () => {},
  } = state;

  return {
    onToggleExpanded: () => setShowExpandedRoster((value) => !value),
    onToggleShowOffline: setShowOffline,
    onShowMore: () => setShowExpandedRoster(true),
    onOpenAbout: () => setShowAbout(true),
    onCloseAbout: () => setShowAbout(false),
    onGuildImageError: () => setGuildImgFailed(true),
    onOpenProfile: (member, event) => {
      const nextProfileCard = buildGuildDashboardProfileCardPayload({
        member,
        event,
        currentUserId,
      });
      if (!nextProfileCard) return;
      setStatusPopover(null);
      setProfileCard(nextProfileCard);
    },
    onCloseProfileCard: () => setProfileCard(null),
    onSendMessage: (selectedUser) => {
      onSelectDM?.({
        other_user_id: selectedUser.userId,
        other_username: selectedUser.username,
        other_npub: selectedUser.npub || null,
      });
    },
  };
}
