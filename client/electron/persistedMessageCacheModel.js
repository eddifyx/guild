const MESSAGE_CACHE_LIMIT = 400;
const MESSAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function encodePersistenceSegment(value) {
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
  dirName = 'message-cache',
}) {
  const dir = path.join(app.getPath('userData'), dirName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMessageCacheFilePath({
  app,
  fs,
  path,
  userId,
  dirName = 'message-cache',
}) {
  return path.join(
    getMessageCacheDir({ app, fs, path, dirName }),
    `${encodePersistenceSegment(userId)}.json`
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

function serializeMessageCache(entries) {
  return JSON.stringify({
    encrypted: false,
    payload: JSON.stringify(entries || {}),
  });
}

function deserializeMessageCache(raw) {
  if (!raw) return {};

  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return {};

  if (!Object.prototype.hasOwnProperty.call(parsed, 'payload')) {
    return parsed;
  }

  if (parsed.encrypted) {
    return {};
  }

  return typeof parsed.payload === 'string' ? JSON.parse(parsed.payload) : {};
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
  MESSAGE_CACHE_LIMIT,
  MESSAGE_CACHE_TTL_MS,
  deserializeMessageCache,
  encodePersistenceSegment,
  getMessageCacheDir,
  getMessageCacheFilePath,
  normalizeMessageCacheEntry,
  pruneMessageCacheEntries,
  serializeMessageCache,
};
