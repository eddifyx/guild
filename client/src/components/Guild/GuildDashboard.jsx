import React from 'react';
import UserProfileCard from '../Common/UserProfileCard';
import {
  GUILD_DASHBOARD_STATUS_MAX_LENGTH,
  formatGuildDashboardLastSeen,
} from '../../features/guild/guildDashboardModel.mjs';
import { useGuildDashboardController } from '../../features/guild/useGuildDashboardController.mjs';
import {
  GuildDashboardAboutModal,
  GuildDashboardHeader,
  GuildDashboardRosterSection,
  StatusPopover,
} from './GuildDashboardPanels.jsx';
import { guildDashboardStyles as styles } from './GuildDashboardStyles.mjs';

export default function GuildDashboard({ onSelectDM, onRosterViewChange }) {
  const controller = useGuildDashboardController({
    onSelectDM,
    onRosterViewChange,
  });

  return (
    <div style={styles.container}>
      {/* Ambient background glows */}
      <div style={styles.ambientGlow} />
      <div style={styles.ambientGlow2} />

      <div style={styles.scrollArea}>
        <GuildDashboardHeader
          guildImageUrl={controller.headerState.guildImageUrl}
          guildImgFailed={!controller.headerState.guildImageUrl && !!controller.headerState.guildImage}
          guildName={controller.headerState.guildName}
          guildMotd={controller.headerState.guildMotd}
          guildDescription={controller.headerState.guildDescription}
          memberCount={controller.members.length}
          onlineCount={controller.rosterState.onlineCount}
          editingStatus={controller.editingStatus}
          statusInputRef={controller.statusInputRef}
          statusDraft={controller.displayedStatusDraft}
          setStatusDraft={controller.onStatusDraftChange}
          handleStatusKeyDown={controller.onStatusKeyDown}
          handleStatusSubmit={controller.onStatusSubmit}
          onStartEditingStatus={controller.onStartEditingStatus}
          statusMaxLength={GUILD_DASHBOARD_STATUS_MAX_LENGTH}
          onOpenAbout={controller.onOpenAbout}
          onGuildImageError={controller.onGuildImageError}
          styles={styles}
        />

        <GuildDashboardRosterSection
          visibleMembers={controller.rosterState.visibleMembers}
          memberPool={controller.rosterState.memberPool}
          onlineCount={controller.rosterState.onlineCount}
          totalMemberCount={controller.rosterState.totalMemberCount}
          showOffline={controller.showOffline}
          isRosterExpanded={controller.rosterState.isRosterExpanded}
          hasMore={controller.rosterState.hasMore}
          currentUserId={controller.currentUserId}
          formatLastSeen={controller.formatLastSeen}
          onToggleExpanded={controller.onToggleExpanded}
          onToggleShowOffline={controller.onToggleShowOffline}
          onShowMore={controller.onShowMore}
          onOpenStatus={controller.onOpenStatus}
          onOpenProfile={controller.onOpenProfile}
          styles={styles}
        />
      </div>

      {/* User profile card */}
      {controller.profileCard && (
        <UserProfileCard
          userId={controller.profileCard.user.id}
          username={controller.profileCard.user.username}
          avatarColor={controller.profileCard.user.avatarColor}
          profilePicture={controller.profileCard.user.profilePicture}
          npub={controller.profileCard.user.npub}
          customStatus={controller.profileCard.user.customStatus}
          isOnline={controller.profileCard.user.isOnline}
          position={controller.profileCard.position}
          onClose={controller.onCloseProfileCard}
          onSendMessage={controller.onSendMessage}
        />
      )}

      {controller.statusPopover && (
        <StatusPopover
          username={controller.statusPopover.username}
          status={controller.statusPopover.status}
          position={controller.statusPopover.position}
          onClose={controller.onCloseStatusPopover}
        />
      )}

      {/* About modal */}
      <GuildDashboardAboutModal
        showAbout={controller.showAbout}
        guildName={controller.headerState.guildName}
        guildDescription={controller.headerState.guildDescription}
        onClose={controller.onCloseAbout}
        styles={styles}
      />
    </div>
  );
}
