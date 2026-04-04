import { buildUseGuildSettingsControllerEffectsInput } from './guildSettingsControllerInputs.mjs';
import { useGuildSettingsControllerCallbacks } from './useGuildSettingsControllerCallbacks.mjs';
import { useGuildSettingsResourceLoaders } from './useGuildSettingsResourceLoaders.mjs';
import { useGuildSettingsRuntimeEffects } from './useGuildSettingsRuntimeEffects.mjs';

export function useGuildSettingsControllerSupport({
  currentGuild = null,
  currentGuildData = null,
  openTraceId = null,
  onClose = () => {},
  state = {},
  deps = {},
} = {}) {
  const {
    tab = 'Overview',
    setTab = () => {},
    membersLoaded = false,
    setMembers = () => {},
    setMembersLoaded = () => {},
    ranksLoaded = false,
    setRanks = () => {},
    setRanksLoaded = () => {},
    inviteLoaded = false,
    setInviteCode = () => {},
    setInviteLoaded = () => {},
    motdLoaded = false,
    setMotd = () => {},
    setMotdLoaded = () => {},
    setError = () => {},
    setSuccess = () => {},
    startTabTransition = (callback) => callback?.(),
    setGuildName = () => {},
    setGuildDesc = () => {},
    setGuildPublic = () => {},
    setGuildImage = () => {},
    setImagePreview = () => {},
    loadingRef = { current: {} },
    completedOpenTraceIdsRef = { current: new Set() },
  } = state;

  const {
    fetchMembersFn = async () => [],
    fetchRanksFn = async () => [],
    getInviteCodeFn = async () => '',
    getMotdFn = async () => '',
    endPerfTraceAfterNextPaintFn = () => {},
  } = deps;

  const {
    loadMembers,
    loadRanks,
    loadMotd,
    loadInviteCode,
  } = useGuildSettingsResourceLoaders({
    currentGuild,
    membersLoaded,
    ranksLoaded,
    inviteLoaded,
    motdLoaded,
    loadingRef,
    fetchMembersFn,
    fetchRanksFn,
    getInviteCodeFn,
    getMotdFn,
    setMembersFn: setMembers,
    setMembersLoadedFn: setMembersLoaded,
    setRanksFn: setRanks,
    setRanksLoadedFn: setRanksLoaded,
    setInviteCodeFn: setInviteCode,
    setInviteLoadedFn: setInviteLoaded,
    setMotdFn: setMotd,
    setMotdLoadedFn: setMotdLoaded,
  });

  const { flash, onSelectTab } = useGuildSettingsControllerCallbacks({
    tab,
    setTabFn: setTab,
    startTabTransitionFn: startTabTransition,
    setErrorFn: setError,
    setSuccessFn: setSuccess,
  });

  useGuildSettingsRuntimeEffects(buildUseGuildSettingsControllerEffectsInput({
    currentGuild,
    currentGuildData,
    tab,
    membersLoaded,
    ranksLoaded,
    inviteLoaded,
    motdLoaded,
    openTraceId,
    onClose,
    loadingRef,
    completedOpenTraceIdsRef,
    setRanksFn: setRanks,
    setRanksLoadedFn: setRanksLoaded,
    setInviteCodeFn: setInviteCode,
    setInviteLoadedFn: setInviteLoaded,
    setMotdFn: setMotd,
    setMotdLoadedFn: setMotdLoaded,
    setMembersFn: setMembers,
    setMembersLoadedFn: setMembersLoaded,
    setGuildNameFn: setGuildName,
    setGuildDescFn: setGuildDesc,
    setGuildPublicFn: setGuildPublic,
    setGuildImageFn: setGuildImage,
    setImagePreviewFn: setImagePreview,
    loadMembers,
    loadRanks,
    loadInviteCode,
    loadMotd,
    endPerfTraceAfterNextPaintFn,
  }));

  return {
    flash,
    onSelectTab,
    loadMembers,
    loadRanks,
    loadMotd,
    loadInviteCode,
  };
}
