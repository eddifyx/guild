import {
  buildLatestVersionFailure,
  buildLatestVersionResult,
} from './versionCheckRuntime.mjs';
import { getServerUrl } from './apiRuntime.mjs';

export async function checkLatestVersion() {
  try {
    const localVersion = await window.electronAPI?.getAppVersion?.() || '0.0.0';
    const platform = window.electronAPI?.getPlatformTarget?.()
      || window.electronAPI?.getPlatform?.()
      || process.platform
      || 'unknown';
    const serverUrl = getServerUrl();
    const res = await fetch(`${serverUrl}/api/version?platform=${platform}&localVersion=${encodeURIComponent(localVersion)}`);
    if (!res.ok) {
      return buildLatestVersionFailure(localVersion);
    }
    const payload = await res.json();
    return buildLatestVersionResult({
      payload,
      localVersion,
      platform,
      serverUrl,
    });
  } catch {
    return buildLatestVersionFailure();
  }
}
