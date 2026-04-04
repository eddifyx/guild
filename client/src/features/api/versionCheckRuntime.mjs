import { toAbsoluteServerUrl } from './serverUrlModel.mjs';

export function hasRemoteVersionUpdate(localVersion = '0.0.0', remoteVersion = '0.0.0') {
  const local = String(localVersion).split('.').map((value) => Number(value) || 0);
  const remote = String(remoteVersion).split('.').map((value) => Number(value) || 0);
  const maxLength = Math.max(local.length, remote.length, 3);

  for (let index = 0; index < maxLength; index += 1) {
    const localPart = local[index] || 0;
    const remotePart = remote[index] || 0;
    if (remotePart > localPart) {
      return true;
    }
    if (remotePart < localPart) {
      return false;
    }
  }

  return false;
}

export function buildLatestVersionResult({
  payload,
  localVersion,
  platform,
  serverUrl,
}) {
  const remoteVersion = payload?.version || null;
  const rawPlatformDownload = payload?.downloads?.[platform] || null;
  const platformDownload = rawPlatformDownload
    ? {
      ...rawPlatformDownload,
      installerUrl: toAbsoluteServerUrl(rawPlatformDownload.installerUrl, serverUrl),
      archiveUrl: toAbsoluteServerUrl(rawPlatformDownload.archiveUrl, serverUrl),
    }
    : null;

  return {
    hasUpdate: remoteVersion ? hasRemoteVersionUpdate(localVersion, remoteVersion) : false,
    localVersion,
    remoteVersion,
    updateStrategy: payload?.updateStrategy || 'native',
    manualInstallReason: payload?.manualInstallReason || null,
    downloadPageUrl: toAbsoluteServerUrl(payload?.downloadPageUrl, serverUrl),
    platformDownload,
    releasedAt: payload?.releasedAt || null,
    patchNotes: payload?.patchNotes || null,
  };
}

export function buildLatestVersionFailure(localVersion = null) {
  return {
    hasUpdate: false,
    localVersion,
    remoteVersion: null,
    updateStrategy: 'native',
    manualInstallReason: null,
    downloadPageUrl: null,
    platformDownload: null,
    releasedAt: null,
    patchNotes: null,
  };
}
