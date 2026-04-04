export function buildGuildMemberCountLabel(memberCount = 0) {
  const normalizedMemberCount = Number(memberCount) || 0;
  return `${normalizedMemberCount} member${normalizedMemberCount !== 1 ? 's' : ''}`;
}

export function buildGuildDiscoverCardState(guild = {}) {
  return {
    initial: guild?.name?.[0]?.toUpperCase?.() || '?',
    memberLabel: `${buildGuildMemberCountLabel(guild?.memberCount)} · Public`,
  };
}

export function buildGuildJoinConfirmationState(guild = {}) {
  return {
    initial: guild?.name?.[0]?.toUpperCase?.() || '?',
    title: guild?.name ? `Join ${guild.name}?` : 'Join guild?',
    description: `${buildGuildMemberCountLabel(guild?.memberCount)} · Public guild`,
  };
}

export function createGuildOnboardingUpdateAction({
  getUpdateAvailableFn,
  getLatestVersionInfoFn,
  getAppVersionFn,
  checkLatestVersionFn,
  setLatestVersionInfoFn,
  setUpdateAvailableFn,
  setShowUpdateOverlayFn,
  setVersionToastFn,
  setTimeoutFn = setTimeout,
} = {}) {
  return async function handleVersionClick() {
    const updateAvailable = Boolean(getUpdateAvailableFn?.());
    const latestVersionInfo = getLatestVersionInfoFn?.() || null;

    if (updateAvailable && latestVersionInfo) {
      setShowUpdateOverlayFn?.(true);
      return { hasUpdate: true, latestVersionInfo, fromCache: true };
    }

    try {
      const info = await checkLatestVersionFn?.();
      setLatestVersionInfoFn?.(info);

      if (info?.hasUpdate) {
        setUpdateAvailableFn?.(true);
        setShowUpdateOverlayFn?.(true);
        return { hasUpdate: true, latestVersionInfo: info, fromCache: false };
      }

      const versionToast = `You're up to date (v${getAppVersionFn?.() || ''})`;
      setVersionToastFn?.(versionToast);
      setTimeoutFn?.(() => setVersionToastFn?.(null), 3000);
      return { hasUpdate: false, latestVersionInfo: info, versionToast };
    } catch {
      return null;
    }
  };
}
