const SIGNER_STATE_FILE_NAME = 'signer-session.json';

function normalizeRelays(relays) {
  if (!Array.isArray(relays)) return [];
  return relays.filter((relay) => typeof relay === 'string' && relay.length > 0);
}

function normalizeOptionalSecret(secret) {
  return typeof secret === 'string' && secret.trim()
    ? secret.trim()
    : null;
}

function normalizeSignerState(state) {
  if (!state || typeof state !== 'object') return null;

  if (state.mode === 'nip46') {
    if (typeof state.clientSecretKey !== 'string' || !state.clientSecretKey) return null;
    if (!state.bunkerPointer || typeof state.bunkerPointer !== 'object') return null;
    if (typeof state.bunkerPointer.pubkey !== 'string' || !state.bunkerPointer.pubkey) return null;

    return {
      mode: 'nip46',
      clientSecretKey: state.clientSecretKey,
      userPubkey: typeof state.userPubkey === 'string' && state.userPubkey ? state.userPubkey : null,
      bunkerPointer: {
        pubkey: state.bunkerPointer.pubkey,
        ...(normalizeOptionalSecret(state.bunkerPointer.secret)
          ? { secret: normalizeOptionalSecret(state.bunkerPointer.secret) }
          : {}),
        relays: normalizeRelays(state.bunkerPointer.relays),
      },
    };
  }

  if (state.mode === 'nsec') {
    if (typeof state.secretKey !== 'string' || !state.secretKey) return null;

    return {
      mode: 'nsec',
      secretKey: state.secretKey,
      pubkey: typeof state.pubkey === 'string' && state.pubkey ? state.pubkey : null,
    };
  }

  return null;
}

function getSignerStateFilePath({
  app,
  path,
  fileName = SIGNER_STATE_FILE_NAME,
}) {
  return path.join(app.getPath('userData'), fileName);
}

function createPersistedSignerStateRuntime({
  app,
  fs,
  path,
  logger = console,
  fileName = SIGNER_STATE_FILE_NAME,
}) {
  function readSignerState() {
    const filePath = getSignerStateFilePath({ app, path, fileName });
    if (!fs.existsSync(filePath)) return null;

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return normalizeSignerState(parsed);
    } catch (err) {
      logger.warn('[SignerState] Failed to read signer state:', err?.message || err);
      return null;
    }
  }

  function writeSignerState(state) {
    const normalized = normalizeSignerState(state);
    if (!normalized) return false;

    try {
      const filePath = getSignerStateFilePath({ app, path, fileName });
      fs.writeFileSync(filePath, JSON.stringify(normalized), {
        encoding: 'utf8',
        mode: 0o600,
      });
      try {
        fs.chmodSync(filePath, 0o600);
      } catch {}
      return true;
    } catch (err) {
      logger.warn('[SignerState] Failed to persist signer state:', err?.message || err);
      return false;
    }
  }

  function clearSignerState() {
    const filePath = getSignerStateFilePath({ app, path, fileName });
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
      return true;
    } catch (err) {
      logger.warn('[SignerState] Failed to clear signer state:', err?.message || err);
      return false;
    }
  }

  return {
    clearSignerState,
    getSignerStateFilePath: () => getSignerStateFilePath({ app, path, fileName }),
    readSignerState,
    writeSignerState,
  };
}

module.exports = {
  SIGNER_STATE_FILE_NAME,
  createPersistedSignerStateRuntime,
  getSignerStateFilePath,
  normalizeSignerState,
};
