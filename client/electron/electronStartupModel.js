function sanitizeProfileId(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized ? normalized.slice(0, 32) : null;
}

function sanitizeServerUrl(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function getRuntimeProfile(argv = process.argv, env = process.env) {
  const envProfile = sanitizeProfileId(env.BYZANTINE_PROFILE);
  if (envProfile) return envProfile;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--profile') {
      return sanitizeProfileId(argv[i + 1]);
    }
    if (typeof arg === 'string' && arg.startsWith('--profile=')) {
      return sanitizeProfileId(arg.slice('--profile='.length));
    }
  }

  return null;
}

function getRuntimeServerUrl(argv = process.argv, env = process.env) {
  const envServerUrl = sanitizeServerUrl(env.GUILD_DEFAULT_SERVER_URL || env.VITE_DEFAULT_SERVER_URL || '');
  if (envServerUrl) return envServerUrl;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--server-url') {
      return sanitizeServerUrl(argv[i + 1]);
    }
    if (typeof arg === 'string' && arg.startsWith('--server-url=')) {
      return sanitizeServerUrl(arg.slice('--server-url='.length));
    }
  }

  return null;
}

function detectRuntimeAppFlavor({ app, processRef = process }) {
  if (processRef.env.GUILD_APP_FLAVOR) {
    return processRef.env.GUILD_APP_FLAVOR;
  }

  const runtimeMarkers = [
    processRef.execPath,
    app?.getName?.(),
    app?.getAppPath?.(),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    runtimeMarkers.includes('guild-staging')
    || runtimeMarkers.includes('byzantine-staging')
  ) {
    return 'staging';
  }

  return 'production';
}

module.exports = {
  detectRuntimeAppFlavor,
  getRuntimeProfile,
  getRuntimeServerUrl,
  sanitizeProfileId,
  sanitizeServerUrl,
};
