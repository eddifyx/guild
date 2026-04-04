function createUploadedFilesRepository({ db }) {
  const insertUploadedFile = db.prepare(
    'INSERT INTO uploaded_files (id, stored_name, uploaded_by, file_name, file_type, file_size, encrypted) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const getUploadedFileById = db.prepare('SELECT * FROM uploaded_files WHERE id = ?');
  const getUploadedFileByStoredName = db.prepare('SELECT * FROM uploaded_files WHERE stored_name = ?');
  const getUploadedFilesByMessageId = db.prepare('SELECT * FROM uploaded_files WHERE message_id = ?');
  const getOwnedUnclaimedUploadedFile = db.prepare(
    'SELECT * FROM uploaded_files WHERE id = ? AND uploaded_by = ? AND message_id IS NULL AND guildchat_message_id IS NULL'
  );
  const claimUploadedFileForRoomMessage = db.prepare(
    "UPDATE uploaded_files SET message_id = ?, room_id = ?, dm_user_a = NULL, dm_user_b = NULL, guildchat_message_id = NULL, guildchat_guild_id = NULL, claimed_at = datetime('now') WHERE id = ? AND uploaded_by = ? AND message_id IS NULL AND guildchat_message_id IS NULL"
  );
  const claimUploadedFileForDMMessage = db.prepare(
    "UPDATE uploaded_files SET message_id = ?, room_id = NULL, dm_user_a = ?, dm_user_b = ?, guildchat_message_id = NULL, guildchat_guild_id = NULL, claimed_at = datetime('now') WHERE id = ? AND uploaded_by = ? AND message_id IS NULL AND guildchat_message_id IS NULL"
  );
  const claimUploadedFileForGuildChatMessage = db.prepare(
    "UPDATE uploaded_files SET message_id = NULL, room_id = NULL, dm_user_a = NULL, dm_user_b = NULL, guildchat_message_id = ?, guildchat_guild_id = ?, claimed_at = datetime('now') WHERE id = ? AND uploaded_by = ? AND message_id IS NULL AND guildchat_message_id IS NULL"
  );
  const deleteUploadedFileRecord = db.prepare('DELETE FROM uploaded_files WHERE id = ?');
  const getExpiredUnclaimedUploadedFiles = db.prepare(
    "SELECT * FROM uploaded_files WHERE message_id IS NULL AND guildchat_message_id IS NULL AND created_at <= datetime('now', '-1 day')"
  );
  const deleteExpiredUnclaimedUploadedFiles = db.prepare(
    "DELETE FROM uploaded_files WHERE message_id IS NULL AND guildchat_message_id IS NULL AND created_at <= datetime('now', '-1 day')"
  );
  const getExpiredGuildChatUploadedFiles = db.prepare(
    "SELECT * FROM uploaded_files WHERE guildchat_message_id IS NOT NULL AND claimed_at <= datetime('now', '-7 days')"
  );
  const deleteExpiredGuildChatUploadedFiles = db.prepare(
    "DELETE FROM uploaded_files WHERE guildchat_message_id IS NOT NULL AND claimed_at <= datetime('now', '-7 days')"
  );

  return {
    insertUploadedFile,
    getUploadedFileById,
    getUploadedFileByStoredName,
    getUploadedFilesByMessageId,
    getOwnedUnclaimedUploadedFile,
    claimUploadedFileForRoomMessage,
    claimUploadedFileForDMMessage,
    claimUploadedFileForGuildChatMessage,
    deleteUploadedFileRecord,
    getExpiredUnclaimedUploadedFiles,
    deleteExpiredUnclaimedUploadedFiles,
    getExpiredGuildChatUploadedFiles,
    deleteExpiredGuildChatUploadedFiles,
  };
}

module.exports = {
  createUploadedFilesRepository,
};
