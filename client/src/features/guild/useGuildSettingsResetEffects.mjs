import { useEffect } from 'react';

import {
  buildGuildSettingsGuildSyncState,
  buildGuildSettingsResetState,
} from './guildSettingsRuntimeModel.mjs';

export function useGuildSettingsResetEffects({
  currentGuild = null,
  currentGuildData = null,
  refs = {},
  state = {},
} = {}) {
  const {
    loadingRef = { current: {} },
  } = refs;
  const {
    setRanksFn = () => {},
    setRanksLoadedFn = () => {},
    setInviteCodeFn = () => {},
    setInviteLoadedFn = () => {},
    setMotdFn = () => {},
    setMotdLoadedFn = () => {},
    setMembersFn = () => {},
    setMembersLoadedFn = () => {},
    setGuildNameFn = () => {},
    setGuildDescFn = () => {},
    setGuildPublicFn = () => {},
    setGuildImageFn = () => {},
    setImagePreviewFn = () => {},
  } = state;

  useEffect(() => {
    const resetState = buildGuildSettingsResetState();
    setRanksFn(resetState.ranks);
    setRanksLoadedFn(resetState.ranksLoaded);
    setInviteCodeFn(resetState.inviteCode);
    setInviteLoadedFn(resetState.inviteLoaded);
    setMotdFn(resetState.motd);
    setMotdLoadedFn(resetState.motdLoaded);
    loadingRef.current = resetState.loading;

    if (currentGuildData?.id !== currentGuild || !Array.isArray(currentGuildData?.members)) {
      setMembersFn([]);
      setMembersLoadedFn(false);
    }
  }, [
    currentGuild,
    currentGuildData?.id,
    currentGuildData?.members,
    loadingRef,
    setInviteCodeFn,
    setInviteLoadedFn,
    setMembersFn,
    setMembersLoadedFn,
    setMotdFn,
    setMotdLoadedFn,
    setRanksFn,
    setRanksLoadedFn,
  ]);

  useEffect(() => {
    const syncState = buildGuildSettingsGuildSyncState({
      currentGuild,
      currentGuildData,
    });

    setGuildNameFn(syncState.guildName);
    setGuildDescFn(syncState.guildDesc);
    setGuildPublicFn(syncState.guildPublic);
    setGuildImageFn(syncState.guildImage);
    setImagePreviewFn(null);

    if (syncState.membersLoaded) {
      setMembersFn(syncState.members);
      setMembersLoadedFn(true);
    }
  }, [
    currentGuild,
    currentGuildData,
    setGuildDescFn,
    setGuildImageFn,
    setGuildNameFn,
    setGuildPublicFn,
    setImagePreviewFn,
    setMembersFn,
    setMembersLoadedFn,
  ]);
}
