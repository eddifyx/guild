const { isProtectedStorageAvailable } = require('./authBackupRuntime');

const MESSAGE_CACHE_DIR_NAME = 'message-cache';
const MESSAGE_CACHE_LIMIT = 2000;
const MESSAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function encodeMessageCacheSegment(value) {
  return Buffer.from(String(value || 'default'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getMessageCacheDir({
  app,
  fs,
  path,
  dirName = MESSAGE_CACHE_DIR_NAME,
}) {
  const dir = path.join(app.getPath('userData'), dirName);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function getMessageCacheFilePath({
  app,
  fs,
  path,
  userId,
  dirName = MESSAGE_CACHE_DIR_NAME,
}) {
  return path.join(
    getMessageCacheDir({ app, fs, path, dirName }),
    `${encodeMessageCacheSegment(userId)}.json`
  );
}

function pruneMessageCacheEntries(
  entries,
  {
    now = Date.now(),
    limit = MESSAGE_CACHE_LIMIT,
    ttlMs = MESSAGE_CACHE_TTL_MS,
  } = {}
) {
  const currentNow = typeof now === 'function' ? now() : now;
  const normalized = Object.entries(entries || {})
    .filter(([messageId, entry]) => {
      if (!messageId || !entry || typeof entry !== 'object') return false;
      if (typeof entry.ciphertextHash !== 'string' || typeof entry.body !== 'string') return false;
      if (typeof entry.cachedAt !== 'number' || currentNow - entry.cachedAt > ttlMs) return false;
      return true;
    })
    .sort((a, b) => (a[1]?.cachedAt || 0) - (b[1]?.cachedAt || 0));

  while (normalized.length > limit) {
    normalized.shift();
  }

  return Object.fromEntries(normalized);
}

function serializeMessageCache(entries, { safeStorage }) {
  const payload = JSON.stringify(entries || {});
  if (!isProtectedStorageAvailable({ safeStorage })) return null;

  return JSON.stringify({
    encrypted: true,
    payload: safeStorage.encryptString(payload).toString('base64'),
  });
}

function deserializeMessageCache(raw, { safeStorage }) {
  if (!raw) return { entries: {}, needsRewrite: false };

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { entries: {}, needsRewrite: false };
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
    return { entries: parsed, needsRewrite: true };
  }

  if (parsed.encrypted) {
    if (typeof parsed.payload !== 'string' || !isProtectedStorageAvailable({ safeStorage })) {
      return { entries: {}, needsRewrite: false };
    }

    const decrypted = safeStorage.decryptString(Buffer.from(parsed.payload, 'base64'));
    return { entries: JSON.parse(decrypted), needsRewrite: false };
  }

  return {
    entries: typeof parsed.payload === 'string' ? JSON.parse(parsed.payload) : {},
    needsRewrite: true,
  };
}

function normalizeMessageCacheEntry(entry, { now = Date.now() } = {}) {
  const currentNow = typeof now === 'function' ? now() : now;

  return {
    ciphertextHash: typeof entry?.ciphertextHash === 'string' ? entry.ciphertextHash : '',
    body: typeof entry?.body === 'string' ? entry.body : '',
    attachments: Array.isArray(entry?.attachments) ? entry.attachments : [],
    cachedAt: typeof entry?.cachedAt === 'number' ? entry.cachedAt : currentNow,
  };
}

module.exports = {
  MESSAGE_CACHE_DIR_NAME,
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  deserializeMessageCache,
  encodeMessageCacheSegment,
  getMessageCacheDir,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
};
