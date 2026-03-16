const { handleChat } = require('./chatHandler');
const { handlePresence } = require('./presenceHandler');
const { handleVoice } = require('./voiceHandler');
const { getUserById, getSession, hashToken } = require('../db');
const runtimeMetrics = require('../monitoring/runtimeMetrics');

function initSocket(io) {
  io.use((socket, next) => {
    const { token } = socket.handshake.auth;
    if (!token) {
      runtimeMetrics.recordSocketAuthFailure('missing_token');
      return next(new Error('Authentication required'));
    }

    const session = getSession.get(hashToken(token));
    if (!session) {
      runtimeMetrics.recordSocketAuthFailure('invalid_session');
      return next(new Error('Invalid or expired session'));
    }

    const user = getUserById.get(session.user_id);
    if (!user) {
      runtimeMetrics.recordSocketAuthFailure('user_not_found');
      return next(new Error('User not found'));
    }

    runtimeMetrics.recordSocketAuthSuccess();
    // Set userId and username from the validated session + DB lookup
    socket.handshake.auth.userId = session.user_id;
    socket.handshake.auth.username = user.username;
    next();
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.handshake.auth;
    runtimeMetrics.recordSocketConnectionOpen({ userId });
    console.log(`Connected: ${username} (${userId})`);

    handlePresence(io, socket);
    handleChat(io, socket);
    handleVoice(io, socket);

    socket.on('disconnect', (reason) => {
      runtimeMetrics.recordSocketConnectionClose({ userId, reason });
      console.log(`Disconnected: ${username} (${userId})`);
    });
  });
}

module.exports = { initSocket };
