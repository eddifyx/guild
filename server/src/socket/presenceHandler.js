// Map<userId, Set<socketId>>
const onlineUsers = new Map();

function getOnlineUserIds() {
  return new Set(onlineUsers.keys());
}

function getOnlineList(io, requesterId = null) {
  const {
    getUserById,
    listVisibleGuildmateIds,
    listVisibleContactUserIds,
  } = require('../db');
  const { buildVisibleUserIdSet } = require('../domain/users/visibility');
  const visibleIds = requesterId ? buildVisibleUserIdSet({
    requesterUserId: requesterId,
    guildmateRows: listVisibleGuildmateIds.all(requesterId),
    contactRows: listVisibleContactUserIds.all(requesterId),
  }) : null;
  const list = [];

  for (const [userId, sockets] of onlineUsers) {
    if (sockets.size === 0) continue;
    if (visibleIds && !visibleIds.has(userId)) continue;

    const dbUser = getUserById.get(userId);
    if (!dbUser || userId.startsWith('system-')) continue;

    list.push({
      userId,
      username: dbUser.username,
      avatarColor: dbUser.avatar_color || null,
      npub: dbUser.npub || null,
      lud16: dbUser.lud16 || null,
      profilePicture: dbUser.profile_picture || null,
      customStatus: dbUser.custom_status || '',
    });
  }

  list.sort((a, b) => a.username.localeCompare(b.username));
  return list;
}

function emitPresenceUpdate(io, userId) {
  if (!userId) return;
  io.to(`user:${userId}`).emit('presence:update', {
    onlineUsers: getOnlineList(io, userId),
  });
}

function broadcastPresenceUpdates(io, targetUserIds = null) {
  const recipients = targetUserIds
    ? Array.from(new Set(targetUserIds.filter(Boolean)))
    : Array.from(onlineUsers.keys());

  for (const userId of recipients) {
    if (!onlineUsers.has(userId)) continue;
    emitPresenceUpdate(io, userId);
  }
}

function handlePresence(io, socket) {
  const { userId } = socket.handshake.auth;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  socket.join(`user:${userId}`);
  broadcastPresenceUpdates(io);

  socket.on('presence:request', () => {
    socket.emit('presence:update', { onlineUsers: getOnlineList(io, userId) });
  });

  socket.on('status:update', (data) => {
    if (!data) return;
    const { updateUserStatus } = require('../db');
    const text = (typeof data.status === 'string' ? data.status : '').slice(0, 128);
    updateUserStatus.run(text, userId);
    broadcastPresenceUpdates(io);
  });

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        const { updateLastSeen } = require('../db');
        updateLastSeen.run(userId);
      }
    }

    broadcastPresenceUpdates(io);
  });
}

module.exports = { handlePresence, getOnlineUserIds, getOnlineList, broadcastPresenceUpdates };
