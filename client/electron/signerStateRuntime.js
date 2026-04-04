const { isProtectedStorageAvailable } = require('./authBackupRuntime');

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

function getSignerStateFilePath({ app, path, fileName = SIGNER_STATE_FILE_NAME }) {
  return path.join(app.getPath('userData'), fileName);
}

function createSignerStateRuntime({
  app,
  fs,
  path,
  safeStorage,
  logger = console,
  fileName = SIGNER_STATE_FILE_NAME,
}) {
  function getFilePath() {
    return getSignerStateFilePath({ app, path, fileName });
  }

  function canUseProtectedStorage() {
    return isProtectedStorageAvailable({ safeStorage });
  }

  function clearSignerState() {
    const filePath = getFilePath();
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

  function writeSignerState(state) {
    const normalized = normalizeSignerState(state);
    if (!normalized) return false;
    if (!canUseProtectedStorage()) return false;

    try {
      const payload = JSON.stringify(normalized);
      const serialized = JSON.stringify({
        encrypted: true,
        payload: safeStorage.encryptString(payload).toString('base64'),
      });

      const filePath = getFilePath();
      fs.writeFileSync(filePath, serialized, {
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

  function readSignerState() {
    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) return null;

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let signerState = null;
      let needsRewrite = false;

      if (!parsed || typeof parsed !== 'object' || !Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
        signerState = normalizeSignerState(parsed);
        needsRewrite = !!signerState;
      } else if (parsed.encrypted) {
        if (typeof parsed.payload !== 'string' || !canUseProtectedStorage()) {
          return null;
        }

        const decrypted = safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'));
        signerState = normalizeSignerState(JSON.parse(decrypted));
      } else if (typeof parsed.payload === 'string') {
        signerState = normalizeSignerState(JSON.parse(parsed.payload));
        needsRewrite = !!signerState;
      }

      if (signerState && needsRewrite) {
        if (!writeSignerState(signerState)) {
          clearSignerState();
        }
      }

      return signerState;
    } catch (err) {
      logger.warn('[SignerState] Failed to read signer state:', err?.message || err);
      return null;
    }
  }

  return {
    clearSignerState,
    getSignerStateFilePath: getFilePath,
    isProtectedStorageAvailable: canUseProtectedStorage,
    readSignerState,
    writeSignerState,
  };
}

module.exports = {
  SIGNER_STATE_FILE_NAME,
  createSignerStateRuntime,
  getSignerStateFilePath,
  normalizeSignerState,
};
