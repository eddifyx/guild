function createVoiceRepository({ db }) {
  const createVoiceChannel = db.prepare('INSERT INTO voice_channels (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)');
  const getAllVoiceChannels = db.prepare('SELECT * FROM voice_channels ORDER BY created_at');
  const getVoiceChannelsByGuild = db.prepare('SELECT * FROM voice_channels WHERE guild_id = ? ORDER BY created_at');
  const getVoiceChannelById = db.prepare('SELECT * FROM voice_channels WHERE id = ?');
  const updateVoiceChannelName = db.prepare('UPDATE voice_channels SET name = ? WHERE id = ?');
  const deleteVoiceChannel = db.prepare('DELETE FROM voice_channels WHERE id = ?');

  const addVoiceSession = db.prepare('INSERT OR REPLACE INTO voice_sessions (channel_id, user_id) VALUES (?, ?)');
  const removeVoiceSession = db.prepare('DELETE FROM voice_sessions WHERE channel_id = ? AND user_id = ?');
  const clearChannelVoiceSessions = db.prepare('DELETE FROM voice_sessions WHERE channel_id = ?');
  const removeUserFromAllVoiceChannels = db.prepare('DELETE FROM voice_sessions WHERE user_id = ?');
  const getVoiceChannelParticipants = db.prepare(`
    SELECT vs.*, u.username, u.avatar_color, u.npub
    FROM voice_sessions vs JOIN users u ON vs.user_id = u.id
    WHERE vs.channel_id = ? ORDER BY vs.joined_at
  `);
  const getUserVoiceSession = db.prepare('SELECT * FROM voice_sessions WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1');
  const clearAllVoiceSessions = db.prepare('DELETE FROM voice_sessions');
  const updateVoiceMuteState = db.prepare(
    'UPDATE voice_sessions SET is_muted = ?, is_deafened = ? WHERE channel_id = ? AND user_id = ?'
  );

  return {
    createVoiceChannel,
    getAllVoiceChannels,
    getVoiceChannelsByGuild,
    getVoiceChannelById,
    updateVoiceChannelName,
    deleteVoiceChannel,
    addVoiceSession,
    removeVoiceSession,
    clearChannelVoiceSessions,
    removeUserFromAllVoiceChannels,
    getVoiceChannelParticipants,
    getUserVoiceSession,
    clearAllVoiceSessions,
    updateVoiceMuteState,
  };
}

module.exports = {
  createVoiceRepository,
};
