function createRoomsRepository({ db }) {
  const createRoom = db.prepare('INSERT INTO rooms (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)');
  const getAllRooms = db.prepare('SELECT * FROM rooms ORDER BY created_at');
  const getRoomsByGuild = db.prepare('SELECT * FROM rooms WHERE guild_id = ? ORDER BY created_at');
  const getRoomById = db.prepare('SELECT * FROM rooms WHERE id = ?');
  const addRoomMember = db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?, ?)');
  const removeRoomMember = db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?');
  const getRoomMembers = db.prepare(`
    SELECT u.id, u.username, u.avatar_color, u.last_seen, u.npub, u.profile_picture
    FROM room_members rm JOIN users u ON rm.user_id = u.id
    WHERE rm.room_id = ? ORDER BY u.username
  `);
  const getUserRooms = db.prepare(`
    SELECT r.* FROM rooms r
    JOIN room_members rm ON r.id = rm.room_id
    WHERE rm.user_id = ? ORDER BY r.created_at
  `);
  const isRoomMember = db.prepare('SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?');
  const getRoomMembership = db.prepare('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?');
  const renameRoom = db.prepare('UPDATE rooms SET name = ? WHERE id = ?');
  const deleteRoomRow = db.prepare('DELETE FROM rooms WHERE id = ?');
  const deleteRoomMembers = db.prepare('DELETE FROM room_members WHERE room_id = ?');
  const deleteRoomAttachments = db.prepare(
    'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE room_id = ?)'
  );
  const deleteRoomMessages = db.prepare('DELETE FROM messages WHERE room_id = ?');
  const addUserToGuildRooms = db.transaction((guildId, userId) => {
    const rooms = getRoomsByGuild.all(guildId);
    for (const room of rooms) {
      addRoomMember.run(room.id, userId);
    }
  });
  const removeUserFromGuildRooms = db.transaction((guildId, userId) => {
    const rooms = getRoomsByGuild.all(guildId);
    for (const room of rooms) {
      removeRoomMember.run(room.id, userId);
    }
  });

  return {
    createRoom,
    getAllRooms,
    getRoomsByGuild,
    getRoomById,
    addRoomMember,
    removeRoomMember,
    getRoomMembers,
    getUserRooms,
    isRoomMember,
    getRoomMembership,
    renameRoom,
    deleteRoomRow,
    deleteRoomMembers,
    deleteRoomAttachments,
    deleteRoomMessages,
    addUserToGuildRooms,
    removeUserFromGuildRooms,
  };
}

module.exports = {
  createRoomsRepository,
};
