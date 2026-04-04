export function openUpdateOverlayExternal({ electronApi, url }) {
  if (!url) {
    return false;
  }

  electronApi?.openExternal?.(url);
  return true;
}

export function subscribeToUpdateOverlayProgress({
  electronApi,
  onProgress = () => {},
}) {
  return electronApi?.onUpdateProgress?.((data) => {
    onProgress(data);
  });
}

export async function downloadAndApplyOverlayUpdate({
  electronApi,
  serverUrl,
  updateInfo,
}) {
  const result = await electronApi.downloadUpdate({
    serverUrl,
    archiveUrl: updateInfo?.platformDownload?.archiveUrl || null,
    platformDownload: updateInfo?.platformDownload || null,
  });

  await electronApi.applyUpdate(result);
  return result;
}

export async function beginOverlayUpdate({
  guildVoiceBridge,
  electronApi,
  isManualInstall = false,
  primaryDownloadUrl = null,
  secondaryDownloadUrl = null,
  openExternalFn = openUpdateOverlayExternal,
}) {
  await guildVoiceBridge?.leaveForUpdate?.();

  if (isManualInstall) {
    openExternalFn({
      electronApi,
      url: primaryDownloadUrl || secondaryDownloadUrl,
    });
    return { startedNativeUpdate: false };
  }

  return { startedNativeUpdate: true };
}
