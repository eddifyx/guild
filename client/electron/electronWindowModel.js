function buildWindowRuntimeQuery(runtimeServerUrl) {
  return runtimeServerUrl ? { serverUrl: runtimeServerUrl } : null;
}

function getProfileWindowOffset(profileId) {
  if (!profileId) {
    return null;
  }

  const normalized = String(profileId).trim();
  if (!normalized) {
    return null;
  }

  const seed = Array.from(normalized).reduce(
    (total, char, index) => total + (char.charCodeAt(0) * (index + 1)),
    0,
  );
  const slot = seed % 6;
  return {
    x: 40 + (slot * 36),
    y: 30 + (slot * 28),
  };
}

function buildBrowserWindowOptions({
  appDisplayName,
  iconPath,
  preloadPath,
  profileId,
  profilePartition,
}) {
  const profileOffset = getProfileWindowOffset(profileId);
  return {
    title: appDisplayName,
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    ...(profileOffset || {}),
    backgroundColor: '#0a0a0a',
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      partition: profilePartition,
      backgroundThrottling: false,
    },
  };
}

module.exports = {
  buildBrowserWindowOptions,
  getProfileWindowOffset,
  buildWindowRuntimeQuery,
};
