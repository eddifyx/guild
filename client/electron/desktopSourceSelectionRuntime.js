async function handleDisplayMediaRequest({
  request,
  callback,
  desktopCapturer,
  getPendingSourceId,
  clearPendingSourceId,
  appendDebugLog,
  platform,
  warn = console.warn,
}) {
  appendDebugLog(
    'display-media-request',
    `audioRequested=${Boolean(request.audioRequested)} pendingSourceId=${getPendingSourceId() || 'none'}`
  );

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 0, height: 0 },
    });
    const selectedSourceId = getPendingSourceId();
    clearPendingSourceId();
    const selected = selectedSourceId ? sources.find((source) => source.id === selectedSourceId) : null;

    if (selectedSourceId && !selected) {
      appendDebugLog('display-media-request', `selected source missing: ${selectedSourceId}`);
      warn(`[ScreenShare] Selected source no longer exists: ${selectedSourceId}`);
      callback({});
      return;
    }

    const fallback = selected || sources[0];
    if (!fallback) {
      appendDebugLog('display-media-request', 'no display sources available');
      warn('[ScreenShare] No display sources available for getDisplayMedia request');
      callback({});
      return;
    }

    appendDebugLog(
      'display-media-request',
      `granting source=${fallback.id} selected=${selected ? 'yes' : 'no'} audio=${request.audioRequested && platform === 'win32' ? 'loopback' : 'none'}`
    );
    const response = { video: fallback };
    if (request.audioRequested && platform === 'win32') {
      response.audio = 'loopback';
    }
    callback(response);
  } catch (error) {
    clearPendingSourceId();
    appendDebugLog(
      'display-media-request',
      `enumeration failed: ${error?.name || 'Error'} ${error?.message || error}`
    );
    warn('[ScreenShare] Failed to enumerate display sources:', error);
    callback({});
  }
}

function registerDisplayMediaHandler(targetSession, deps) {
  if (!targetSession?.setDisplayMediaRequestHandler) return false;
  targetSession.setDisplayMediaRequestHandler((request, callback) => {
    void handleDisplayMediaRequest({
      ...deps,
      request,
      callback,
    });
  });
  return true;
}

function selectDesktopSource(sourceId, { setPendingSourceId, appendDebugLog }) {
  setPendingSourceId(sourceId);
  appendDebugLog('select-desktop-source', `sourceId=${sourceId || 'none'}`);
}

module.exports = {
  handleDisplayMediaRequest,
  registerDisplayMediaHandler,
  selectDesktopSource,
};
