function createMessagesWriteRepository({ db }) {
  const insertMessage = db.prepare(
    'INSERT INTO messages (id, content, sender_id, room_id, dm_partner_id, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
  );
  const insertAttachment = db.prepare(
    'INSERT INTO attachments (id, message_id, uploaded_file_id, file_url, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const getMessageById = db.prepare('SELECT * FROM messages WHERE id = ?');
  const updateMessageContent = db.prepare(
    "UPDATE messages SET content = ?, edited_at = datetime('now') WHERE id = ? AND sender_id = ?"
  );
  const deleteMessage = db.prepare('DELETE FROM messages WHERE id = ? AND sender_id = ?');
  const deleteMessageAttachments = db.prepare('DELETE FROM attachments WHERE message_id = ?');
  const getMessageAttachments = db.prepare('SELECT * FROM attachments WHERE message_id = ?');
  const ensureDMConversation = db.prepare(
    'INSERT OR IGNORE INTO dm_conversations (user_a_id, user_b_id) VALUES (?, ?)'
  );
  const deleteDMConversation = db.prepare(
    'DELETE FROM dm_conversations WHERE (user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?)'
  );

  return {
    insertMessage,
    insertAttachment,
    getMessageById,
    updateMessageContent,
    deleteMessage,
    deleteMessageAttachments,
    getMessageAttachments,
    ensureDMConversation,
    deleteDMConversation,
  };
}

module.exports = {
  createMessagesWriteRepository,
};
