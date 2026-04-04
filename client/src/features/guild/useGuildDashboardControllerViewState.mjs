import { useMemo } from 'react';

import { getFileUrl } from '../../api';
import {
  GUILD_DASHBOARD_STATUS_MAX_LENGTH,
  buildGuildDashboardRosterState,
  enrichGuildDashboardMembers,
  formatGuildDashboardLastSeen,
} from './guildDashboardModel.mjs';
import {
  buildGuildDashboardHeaderState,
  buildGuildDashboardStatusDraft,
} from './guildDashboardControllerModel.mjs';

export function useGuildDashboardControllerViewState({
  members = [],
  onlineUsers = [],
  onlineIds = new Set(),
  showOffline = false,
  showExpandedRoster = false,
  currentGuildData = null,
  guildImgFailed = false,
  editingStatus = false,
  statusDraft = '',
  myStatus = '',
} = {}) {
  const enrichedMembers = useMemo(() => enrichGuildDashboardMembers({
    members,
    onlineUsers,
    onlineIds,
  }), [members, onlineIds, onlineUsers]);

  const rosterState = useMemo(() => buildGuildDashboardRosterState({
    members: enrichedMembers,
    showOffline,
    showExpandedRoster,
  }), [enrichedMembers, showExpandedRoster, showOffline]);

  const headerState = useMemo(() => buildGuildDashboardHeaderState({
    currentGuildData,
    guildImgFailed,
    getFileUrlFn: getFileUrl,
  }), [currentGuildData, guildImgFailed]);

  const displayedStatusDraft = useMemo(() => buildGuildDashboardStatusDraft({
    editingStatus,
    statusDraft,
    myStatus,
  }), [editingStatus, myStatus, statusDraft]);

  return {
    maxStatusLength: GUILD_DASHBOARD_STATUS_MAX_LENGTH,
    rosterState,
    headerState,
    displayedStatusDraft,
    formatLastSeen: formatGuildDashboardLastSeen,
  };
}
