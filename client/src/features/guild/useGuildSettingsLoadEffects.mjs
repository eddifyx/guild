import { useEffect } from 'react';

import {
  buildGuildSettingsTabLoadPlan,
  buildGuildSettingsWarmLoadPlan,
} from './guildSettingsRuntimeModel.mjs';

export function useGuildSettingsLoadEffects({
  currentGuild = null,
  tab = 'Overview',
  membersLoaded = false,
  ranksLoaded = false,
  inviteLoaded = false,
  motdLoaded = false,
  load = {},
} = {}) {
  const {
    loadMembers = async () => {},
    loadRanks = async () => {},
    loadInviteCode = async () => {},
    loadMotd = async () => {},
  } = load;

  useEffect(() => {
    const warmPlan = buildGuildSettingsWarmLoadPlan({
      currentGuild,
      membersLoaded,
      motdLoaded,
      ranksLoaded,
    });

    if (!currentGuild) {
      return undefined;
    }

    if (warmPlan.loadMembers) {
      loadMembers().catch(console.error);
    }
    if (warmPlan.loadMotd) {
      loadMotd().catch(() => {});
    }

    const rankWarmTimer = window.setTimeout(() => {
      if (warmPlan.warmRanks) {
        loadRanks().catch(console.error);
      }
    }, 120);

    return () => window.clearTimeout(rankWarmTimer);
  }, [currentGuild, loadMembers, loadMotd, loadRanks, membersLoaded, motdLoaded, ranksLoaded]);

  useEffect(() => {
    const loadPlan = buildGuildSettingsTabLoadPlan({
      currentGuild,
      tab,
      membersLoaded,
      ranksLoaded,
      inviteLoaded,
      motdLoaded,
    });

    if (loadPlan.loadMembers) {
      loadMembers().catch(console.error);
    }
    if (loadPlan.loadRanks) {
      loadRanks().catch(console.error);
    }
    if (loadPlan.loadInvite) {
      loadInviteCode().catch(() => {});
    }
    if (loadPlan.loadMotd) {
      loadMotd().catch(() => {});
    }
  }, [currentGuild, inviteLoaded, loadInviteCode, loadMembers, loadMotd, loadRanks, membersLoaded, motdLoaded, ranksLoaded, tab]);
}
