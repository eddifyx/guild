export async function handleMainLayoutUpdateAction({
  updateAvailable = false,
  latestVersionInfo = null,
  appVersion = '',
  refreshLatestVersionInfoFn = async () => null,
  setShowUpdateOverlayFn = () => {},
  setVersionToastFn = () => {},
  setTimeoutFn = globalThis.setTimeout,
  toastDurationMs = 3000,
} = {}) {
  if (updateAvailable) {
    if (latestVersionInfo) {
      setShowUpdateOverlayFn(true);
      return { action: 'open-overlay', info: latestVersionInfo };
    }

    const info = await refreshLatestVersionInfoFn();
    if (info?.hasUpdate) {
      setShowUpdateOverlayFn(true);
      return { action: 'open-overlay', info };
    }

    return { action: 'noop', info };
  }

  const info = await refreshLatestVersionInfoFn();
  if (info?.hasUpdate) {
    setShowUpdateOverlayFn(true);
    return { action: 'open-overlay', info };
  }

  const toastMessage = `You're up to date (v${appVersion})`;
  setVersionToastFn(toastMessage);
  setTimeoutFn(() => setVersionToastFn(null), toastDurationMs);
  return { action: 'show-toast', info, toastMessage };
}
