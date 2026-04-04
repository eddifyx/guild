const path = require('path');

function loadTlsOptions({
  keyPath = '',
  certPath = '',
  caPath = '',
  readFileSyncFn,
}) {
  if (!keyPath && !certPath) {
    return null;
  }
  if (!keyPath || !certPath) {
    throw new Error('Both TLS_KEY_PATH and TLS_CERT_PATH are required to enable HTTPS');
  }

  const options = {
    key: readFileSyncFn(keyPath),
    cert: readFileSyncFn(certPath),
  };

  if (caPath) {
    options.ca = readFileSyncFn(caPath);
  }

  return options;
}

function readClientVersion({ clientVersionPath, readFileSyncFn }) {
  try {
    return JSON.parse(readFileSyncFn(clientVersionPath, 'utf8'));
  } catch {
    return { version: '0.0.0' };
  }
}

function normalizePlatform(rawPlatform = '') {
  const platform = String(rawPlatform || '').trim().toLowerCase();
  switch (platform) {
    case 'darwin':
    case 'mac':
    case 'macos':
    case 'osx':
      return 'darwin-arm64';
    case 'win32':
    case 'windows':
      return 'win32-x64';
    default:
      return platform;
  }
}

function resolveVersionInfoForPlatform(versionInfo, rawPlatform = '') {
  const normalizedPlatform = normalizePlatform(rawPlatform);
  const {
    platformOverrides,
    ...baseVersionInfo
  } = (versionInfo && typeof versionInfo === 'object') ? versionInfo : { version: '0.0.0' };

  if (!platformOverrides || typeof platformOverrides !== 'object') {
    return baseVersionInfo;
  }

  const override = platformOverrides[normalizedPlatform];
  if (!override || typeof override !== 'object') {
    return baseVersionInfo;
  }

  return {
    ...baseVersionInfo,
    ...override,
  };
}

function getRequestProtocol(req) {
  const forwardedProto = req.get('x-forwarded-proto');
  if (typeof forwardedProto === 'string' && forwardedProto.trim()) {
    return forwardedProto.split(',')[0].trim();
  }
  if (req.secure || req.socket?.encrypted) {
    return 'https';
  }
  return 'http';
}

function buildHttpsRedirectUrl(req, { httpRedirectPort = null, appPort } = {}) {
  const hostHeader = req.get('x-forwarded-host') || req.get('host') || 'localhost';
  const normalizedHost = httpRedirectPort && Number(appPort) !== 443
    ? hostHeader.replace(/:\d+$/, `:${appPort}`)
    : (Number(appPort) === 443 ? hostHeader.replace(/:\d+$/, '') : hostHeader);
  return `https://${normalizedHost}${req.url}`;
}

function isAllowedOrigin(origin, { allowedOrigins = [] } = {}) {
  if (origin === undefined) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^(app|file):\/\//.test(origin)) return true;
  if (allowedOrigins.includes(origin)) return true;
  return false;
}

function isLoopbackIp(ip = '') {
  return ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.');
}

function canAccessUploadedFile(file, userId, {
  isRoomMemberFn,
  usersShareGuildFn,
} = {}) {
  if (!file || !userId) return false;
  if (file.uploaded_by === userId) return true;
  if (!file.message_id) return false;
  if (file.room_id) {
    return !!isRoomMemberFn?.(file.room_id, userId);
  }
  if (file.dm_user_a && file.dm_user_b) {
    if (file.dm_user_a !== userId && file.dm_user_b !== userId) {
      return false;
    }
    return !!usersShareGuildFn?.(file.dm_user_a, file.dm_user_b);
  }
  return false;
}

function buildAbsoluteUrl(req, relativePath, {
  getRequestProtocolFn = getRequestProtocol,
} = {}) {
  const protocol = getRequestProtocolFn(req);
  return `${protocol}://${req.get('host')}${relativePath}`;
}

function resolveUpdateArtifact(relativePath, {
  updatesDir,
  existsSyncFn,
}) {
  const filename = relativePath.replace(/^\/updates\//, '');
  const absolutePath = path.join(updatesDir, filename);
  return existsSyncFn(absolutePath) ? relativePath : null;
}

function buildUpdateDownloads(req, version, {
  updatesDir,
  existsSyncFn,
  getRequestProtocolFn = getRequestProtocol,
} = {}) {
  const buildUrl = (relativePath) => buildAbsoluteUrl(req, relativePath, { getRequestProtocolFn });
  const resolveArtifact = (relativePath) => resolveUpdateArtifact(relativePath, {
    updatesDir,
    existsSyncFn,
  });

  const darwinInstallerPath = resolveArtifact(`/updates/guild-${version}-arm64.dmg`);
  const darwinArchivePath = resolveArtifact(`/updates/guild-darwin-arm64-${version}.zip`);
  const windowsArchivePath = resolveArtifact(`/updates/guild-win32-x64-${version}.zip`);

  return {
    'darwin-arm64': {
      label: 'Mac Apple Silicon',
      installerUrl: darwinInstallerPath ? buildUrl(darwinInstallerPath) : null,
      archiveUrl: darwinArchivePath ? buildUrl(darwinArchivePath) : null,
    },
    'win32-x64': {
      label: 'Windows 10 x64',
      installerUrl: windowsArchivePath ? buildUrl(windowsArchivePath) : null,
      archiveUrl: windowsArchivePath ? buildUrl(windowsArchivePath) : null,
    },
  };
}

function resolveUpdateDelivery(platform, downloads) {
  const platformDownload = downloads?.[platform] || null;
  const hasNativeArchive = Boolean(platformDownload?.archiveUrl);

  if (hasNativeArchive) {
    return {
      updateStrategy: 'native',
      manualInstallReason: null,
    };
  }

  return {
    updateStrategy: 'manual-install',
    manualInstallReason: 'Direct download is required until an auto-update archive is published for this platform.',
  };
}

module.exports = {
  loadTlsOptions,
  readClientVersion,
  normalizePlatform,
  resolveVersionInfoForPlatform,
  getRequestProtocol,
  buildHttpsRedirectUrl,
  isAllowedOrigin,
  isLoopbackIp,
  canAccessUploadedFile,
  buildAbsoluteUrl,
  resolveUpdateArtifact,
  buildUpdateDownloads,
  resolveUpdateDelivery,
};
