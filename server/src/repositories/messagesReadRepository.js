function createMessagesReadRepository({ db, getRoomMembership }) {
  function getRoomMessages(roomId, userId, before, limit = 50) {
    const membership = getRoomMembership.get(roomId, userId);
    if (!membership) return [];

    if (before) {
      return db.prepare(`
        SELECT m.*, u.username as sender_name, u.avatar_color as sender_color, u.npub as sender_npub, u.profile_picture as sender_picture
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.room_id = ? AND m.created_at < ?
        ORDER BY m.created_at DESC LIMIT ?
      `).all(roomId, before, limit).reverse();
    }
    return db.prepare(`
      SELECT m.*, u.username as sender_name, u.avatar_color as sender_color, u.npub as sender_npub, u.profile_picture as sender_picture
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at DESC LIMIT ?
    `).all(roomId, limit).reverse();
  }

  function getDMMessages(userAId, userBId, before, limit = 50) {
    if (before) {
      return db.prepare(`
        SELECT m.*, u.username as sender_name, u.avatar_color as sender_color, u.npub as sender_npub, u.profile_picture as sender_picture
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE ((m.sender_id = ? AND m.dm_partner_id = ?) OR (m.sender_id = ? AND m.dm_partner_id = ?))
          AND m.created_at < ?
        ORDER BY m.created_at DESC LIMIT ?
      `).all(userAId, userBId, userBId, userAId, before, limit).reverse();
    }
    return db.prepare(`
      SELECT m.*, u.username as sender_name, u.avatar_color as sender_color, u.npub as sender_npub, u.profile_picture as sender_picture
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE (m.sender_id = ? AND m.dm_partner_id = ?) OR (m.sender_id = ? AND m.dm_partner_id = ?)
      ORDER BY m.created_at DESC LIMIT ?
    `).all(userAId, userBId, userBId, userAId, limit).reverse();
  }

  function getAttachmentsForMessages(messageIds) {
    if (!messageIds.length) return {};
    const placeholders = messageIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM attachments WHERE message_id IN (${placeholders})`
    ).all(...messageIds);
    const attachmentMap = {};
    for (const row of rows) {
      if (!attachmentMap[row.message_id]) attachmentMap[row.message_id] = [];
      attachmentMap[row.message_id].push(row);
    }
    return attachmentMap;
  }

  function listRawDMConversations(userId) {
    return db.prepare(`
      SELECT dc.*,
        CASE WHEN dc.user_a_id = ? THEN dc.user_b_id ELSE dc.user_a_id END as other_user_id,
        u.username as other_username,
        u.avatar_color as other_avatar_color,
        u.profile_picture as other_profile_picture,
        u.last_seen as other_last_seen,
        u.npub as other_npub
      FROM dm_conversations dc
      JOIN users u ON u.id = CASE WHEN dc.user_a_id = ? THEN dc.user_b_id ELSE dc.user_a_id END
      WHERE dc.user_a_id = ? OR dc.user_b_id = ?
      ORDER BY dc.created_at DESC
    `).all(userId, userId, userId, userId);
  }

  return {
    getRoomMessages,
    getDMMessages,
    getAttachmentsForMessages,
    listRawDMConversations,
  };
}

module.exports = {
  createMessagesReadRepository,
};
