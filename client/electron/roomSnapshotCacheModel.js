const ROOM_SNAPSHOT_LIMIT = 40;
const ROOM_SNAPSHOT_MESSAGE_LIMIT = 20;
const ROOM_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

function encodePersistenceSegment(value) {
  return Buffer.from(String(value || 'default'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getRoomSnapshotCacheDir({
  app,
  fs,
  path,
  dirName = 'room-snapshots',
}) {
  const dir = path.join(app.getPath('userData'), dirName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getRoomSnapshotCacheFilePath({
  app,
  fs,
  path,
  userId,
  dirName = 'room-snapshots',
}) {
  return path.join(
    getRoomSnapshotCacheDir({ app, fs, path, dirName }),
    `${encodePersistenceSegment(userId)}.json`
  );
}

function sanitizeRoomSnapshotMessage(message) {
  if (!message || typeof message !== 'object') return null;
  if (message._optimistic) return null;

  const sanitizeAttachments = (attachments) => (
    Array.isArray(attachments)
      ? attachments.map((attachment) => {
          if (!attachment || typeof attachment !== 'object') return attachment;
          const { _previewUrl, ...rest } = attachment;
          return rest;
        })
      : []
  );

  return {
    ...message,
    attachments: sanitizeAttachments(message.attachments),
    _decryptedAttachments: sanitizeAttachments(message._decryptedAttachments),
  };
}

function pruneRoomSnapshotEntries(
  entries,
  {
    now = Date.now(),
    limit = ROOM_SNAPSHOT_LIMIT,
    messageLimit = ROOM_SNAPSHOT_MESSAGE_LIMIT,
    ttlMs = ROOM_SNAPSHOT_TTL_MS,
  } = {}
) {
  const currentNow = typeof now === 'function' ? now() : now;
  const normalized = Object.entries(entries || {})
    .filter(([roomId, entry]) => {
      if (!roomId || !entry || typeof entry !== 'object') return false;
      if (typeof entry.cachedAt !== 'number' || currentNow - entry.cachedAt > ttlMs) return false;
      if (!Array.isArray(entry.messages) || entry.messages.length === 0) return false;
      return true;
    })
    .map(([roomId, entry]) => {
      const messages = entry.messages
        .map((message) => sanitizeRoomSnapshotMessage(message))
        .filter(Boolean)
        .slice(-messageLimit);
      if (messages.length === 0) return null;
      return [roomId, {
        cachedAt: entry.cachedAt,
        hasMore: !!entry.hasMore,
        messages,
      }];
    })
    .filter(Boolean)
    .sort((a, b) => (a[1]?.cachedAt || 0) - (b[1]?.cachedAt || 0));

  while (normalized.length > limit) {
    normalized.shift();
  }

  return Object.fromEntries(normalized);
}

module.exports = {
  ROOM_SNAPSHOT_LIMIT,
  ROOM_SNAPSHOT_MESSAGE_LIMIT,
  ROOM_SNAPSHOT_TTL_MS,
  encodePersistenceSegment,
  getRoomSnapshotCacheDir,
  getRoomSnapshotCacheFilePath,
  pruneRoomSnapshotEntries,
  sanitizeRoomSnapshotMessage,
};
