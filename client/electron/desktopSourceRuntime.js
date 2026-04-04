const {
  buildDesktopSourceThumbnails,
  createEmptyDesktopSourceCache,
  nativeImageToDataUrl,
  serializeDesktopSource,
} = require('./desktopSourceModel');
const {
  getDesktopSources,
  getDesktopThumbnails,
  getDesktopWindows,
  prefetchDesktopSources,
} = require('./desktopSourceQueryRuntime');
const {
  handleDisplayMediaRequest,
  registerDisplayMediaHandler,
  selectDesktopSource,
} = require('./desktopSourceSelectionRuntime');

function getScreenCaptureAccessStatus({
  platform,
  systemPreferences,
  appendDebugLog,
  warn = console.warn,
}) {
  if (platform !== 'darwin') return 'granted';
  try {
    const status = systemPreferences.getMediaAccessStatus('screen');
    appendDebugLog('screen-capture-access-status', `status=${status}`);
    return status;
  } catch (error) {
    appendDebugLog(
      'screen-capture-access-status',
      `failed: ${error?.name || 'Error'} ${error?.message || error}`
    );
    warn('[ScreenShare] Failed to read screen capture permission:', error);
    return 'unknown';
  }
}

async function openScreenCaptureSettings({
  platform,
  openExternal,
  appendDebugLog,
  warn = console.warn,
}) {
  if (platform !== 'darwin') return false;
  try {
    appendDebugLog('open-screen-capture-settings', 'invoked');
    await openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    return true;
  } catch (error) {
    appendDebugLog(
      'open-screen-capture-settings',
      `failed: ${error?.name || 'Error'} ${error?.message || error}`
    );
    warn('[ScreenShare] Failed to open Screen Recording settings:', error);
    return false;
  }
}

module.exports = {
  buildDesktopSourceThumbnails,
  createEmptyDesktopSourceCache,
  getDesktopSources,
  getDesktopThumbnails,
  getDesktopWindows,
  getScreenCaptureAccessStatus,
  handleDisplayMediaRequest,
  nativeImageToDataUrl,
  openScreenCaptureSettings,
  prefetchDesktopSources,
  registerDisplayMediaHandler,
  selectDesktopSource,
  serializeDesktopSource,
};
