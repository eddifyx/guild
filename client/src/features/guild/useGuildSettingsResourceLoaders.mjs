import { useCallback } from 'react';

import { createGuildSettingsResourceLoader } from './guildSettingsControllerRuntime.mjs';

export function useGuildSettingsResourceLoaders({
  currentGuild = null,
  membersLoaded = false,
  ranksLoaded = false,
  inviteLoaded = false,
  motdLoaded = false,
  loadingRef,
  fetchMembersFn,
  fetchRanksFn,
  getInviteCodeFn,
  getMotdFn,
  setMembersFn = () => {},
  setMembersLoadedFn = () => {},
  setRanksFn = () => {},
  setRanksLoadedFn = () => {},
  setInviteCodeFn = () => {},
  setInviteLoadedFn = () => {},
  setMotdFn = () => {},
  setMotdLoadedFn = () => {},
} = {}) {
  const loadMembers = useCallback(createGuildSettingsResourceLoader({
    currentGuild,
    isLoaded: membersLoaded,
    loadingRef,
    loadingKey: 'members',
    fetchFn: async (guildId) => fetchMembersFn(guildId),
    commitFn: (nextMembers) => {
      setMembersFn(nextMembers);
      setMembersLoadedFn(true);
    },
    emptyValue: [],
  }), [currentGuild, fetchMembersFn, membersLoaded, loadingRef, setMembersFn, setMembersLoadedFn]);

  const loadRanks = useCallback(createGuildSettingsResourceLoader({
    currentGuild,
    isLoaded: ranksLoaded,
    loadingRef,
    loadingKey: 'ranks',
    fetchFn: async (guildId) => fetchRanksFn(guildId),
    commitFn: (nextRanks) => {
      setRanksFn(nextRanks);
      setRanksLoadedFn(true);
    },
    emptyValue: [],
  }), [currentGuild, fetchRanksFn, ranksLoaded, loadingRef, setRanksFn, setRanksLoadedFn]);

  const loadMotd = useCallback(createGuildSettingsResourceLoader({
    currentGuild,
    isLoaded: motdLoaded,
    loadingRef,
    loadingKey: 'motd',
    fetchFn: async (guildId) => getMotdFn(guildId),
    commitFn: (nextMotd) => {
      setMotdFn(nextMotd || '');
      setMotdLoadedFn(true);
    },
    emptyValue: '',
  }), [currentGuild, getMotdFn, motdLoaded, loadingRef, setMotdFn, setMotdLoadedFn]);

  const loadInviteCode = useCallback(createGuildSettingsResourceLoader({
    currentGuild,
    isLoaded: inviteLoaded,
    loadingRef,
    loadingKey: 'invite',
    fetchFn: async (guildId) => getInviteCodeFn(guildId),
    commitFn: (nextInviteCode) => {
      setInviteCodeFn(nextInviteCode || '');
      setInviteLoadedFn(true);
    },
    emptyValue: '',
  }), [currentGuild, getInviteCodeFn, inviteLoaded, loadingRef, setInviteCodeFn, setInviteLoadedFn]);

  return {
    loadMembers,
    loadRanks,
    loadMotd,
    loadInviteCode,
  };
}
