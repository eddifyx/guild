function createGuildsRepository({ db }) {
  const createGuild = db.prepare(
    'INSERT INTO guilds (id, name, description, image_url, banner_url, accent_color, bg_color, created_by, is_public, invite_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const getGuildById = db.prepare('SELECT * FROM guilds WHERE id = ?');
  const getAllPublicGuilds = db.prepare('SELECT * FROM guilds WHERE is_public = 1 ORDER BY ranking_score DESC, created_at DESC');
  const getGuildByInviteCode = db.prepare('SELECT * FROM guilds WHERE invite_code = ?');
  const updateGuild = db.prepare(
    'UPDATE guilds SET name = ?, description = ?, image_url = ?, banner_url = ?, accent_color = ?, bg_color = ?, is_public = ? WHERE id = ?'
  );
  const updateGuildMotd = db.prepare('UPDATE guilds SET motd = ? WHERE id = ?');
  const deleteGuildRow = db.prepare('DELETE FROM guilds WHERE id = ?');
  const getUserCreatedGuildCount = db.prepare('SELECT COUNT(*) as count FROM guilds WHERE created_by = ?');
  const updateGuildInviteCode = db.prepare('UPDATE guilds SET invite_code = ? WHERE id = ?');

  const createGuildRank = db.prepare(
    'INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)'
  );
  const getGuildRanks = db.prepare('SELECT * FROM guild_ranks WHERE guild_id = ? ORDER BY rank_order');
  const getLowestRanksByGuild = db.prepare(`
    SELECT gr.*
    FROM guild_ranks gr
    WHERE gr.rank_order = (
      SELECT MAX(inner_gr.rank_order)
      FROM guild_ranks inner_gr
      WHERE inner_gr.guild_id = gr.guild_id
    )
    ORDER BY gr.guild_id, gr.rank_order
  `);
  const getGuildRankById = db.prepare('SELECT * FROM guild_ranks WHERE id = ?');
  const updateGuildRank = db.prepare('UPDATE guild_ranks SET name = ?, permissions = ? WHERE id = ?');
  const deleteGuildRank = db.prepare('DELETE FROM guild_ranks WHERE id = ?');
  const getLowestRank = db.prepare('SELECT * FROM guild_ranks WHERE guild_id = ? ORDER BY rank_order DESC LIMIT 1');

  const addGuildMember = db.prepare(
    'INSERT OR IGNORE INTO guild_members (guild_id, user_id, rank_id) VALUES (?, ?, ?)'
  );
  const removeGuildMember = db.prepare('DELETE FROM guild_members WHERE guild_id = ? AND user_id = ?');
  const getGuildMembers = db.prepare(`
    SELECT u.id, u.username, u.npub, u.avatar_color, u.profile_picture, u.last_seen,
           gm.rank_id, gm.public_note, gm.officer_note, gm.joined_at,
           gm.permission_overrides,
           gr.name as rank_name, gr.rank_order, gr.permissions
    FROM guild_members gm
    JOIN users u ON gm.user_id = u.id
    JOIN guild_ranks gr ON gm.rank_id = gr.id
    WHERE gm.guild_id = ? ORDER BY gr.rank_order, u.username
  `);
  const getUserGuilds = db.prepare(`
    SELECT g.*, gm.rank_id, gr.name as rank_name, gr.rank_order, gr.permissions
    FROM guilds g
    JOIN guild_members gm ON g.id = gm.guild_id
    JOIN guild_ranks gr ON gm.rank_id = gr.id
    WHERE gm.user_id = ?
  `);
  const isGuildMember = db.prepare(
    'SELECT gm.*, gm.permission_overrides, gr.name as rank_name, gr.rank_order, gr.permissions FROM guild_members gm JOIN guild_ranks gr ON gm.rank_id = gr.id WHERE gm.guild_id = ? AND gm.user_id = ?'
  );
  const usersShareGuild = db.prepare(`
    SELECT 1
    FROM guild_members gm_a
    JOIN guild_members gm_b ON gm_a.guild_id = gm_b.guild_id
    WHERE gm_a.user_id = ? AND gm_b.user_id = ?
    LIMIT 1
  `);
  const updateMemberRank = db.prepare('UPDATE guild_members SET rank_id = ? WHERE guild_id = ? AND user_id = ?');
  const updatePublicNote = db.prepare('UPDATE guild_members SET public_note = ? WHERE guild_id = ? AND user_id = ?');
  const updateOfficerNote = db.prepare('UPDATE guild_members SET officer_note = ? WHERE guild_id = ? AND user_id = ?');
  const getGuildMemberCount = db.prepare('SELECT COUNT(*) as count FROM guild_members WHERE guild_id = ?');
  const deleteGuildMembers = db.prepare('DELETE FROM guild_members WHERE guild_id = ?');
  const deleteGuildRanks = db.prepare('DELETE FROM guild_ranks WHERE guild_id = ?');
  const updateMemberPermissionOverrides = db.prepare(
    'UPDATE guild_members SET permission_overrides = ? WHERE guild_id = ? AND user_id = ?'
  );

  return {
    createGuild,
    getGuildById,
    getAllPublicGuilds,
    getGuildByInviteCode,
    updateGuild,
    updateGuildMotd,
    deleteGuildRow,
    getUserCreatedGuildCount,
    updateGuildInviteCode,
    createGuildRank,
    getGuildRanks,
    getLowestRanksByGuild,
    getGuildRankById,
    updateGuildRank,
    deleteGuildRank,
    getLowestRank,
    addGuildMember,
    removeGuildMember,
    getGuildMembers,
    getUserGuilds,
    isGuildMember,
    usersShareGuild,
    updateMemberRank,
    updatePublicNote,
    updateOfficerNote,
    getGuildMemberCount,
    deleteGuildMembers,
    deleteGuildRanks,
    updateMemberPermissionOverrides,
  };
}

module.exports = {
  createGuildsRepository,
};
