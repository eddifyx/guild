const { handleChat } = require('./chatHandler');
const { handlePresence } = require('./presenceHandler');
const { handleVoice } = require('./voiceHandler');
const { getUserById, getSession, hashToken } = require('../db');

function initSocket(io) {
  io.use((socket, next) => {
    const { token } = socket.handshake.auth;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const session = getSession.get(hashToken(token));
    if (!session) {
      return next(new Error('Invalid or expired session'));
    }

    const user = getUserById.get(session.user_id);
    if (!user) {
      return next(new Error('User not found'));
    }

    // Set userId and username from the validated session + DB lookup
    socket.handshake.auth.userId = session.user_id;
    socket.handshake.auth.username = user.username;
    next();
  });

  io.on('connection', (socket) => {
    const { userId, username } = socket.handshake.auth;
    console.log(`Connected: ${username} (${userId})`);

    handlePresence(io, socket);
    handleChat(io, socket);
    handleVoice(io, socket);

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${username} (${userId})`);
    });
  });
}

module.exports = { initSocket };
