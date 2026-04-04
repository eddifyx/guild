const { pickGuildMembershipToKeep } = require('./databaseBootstrapModel');

function migrateLegacyGuildColumns({ db, buildDefaultGuildRankRows, log = console } = {}) {
  const roomCols = db.prepare('PRAGMA table_info(rooms)').all();
  const hasGuildId = roomCols.some((column) => column.name === 'guild_id');

  if (hasGuildId) {
    return false;
  }

  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    const sysId = 'system-00000000-0000-0000-0000-000000000000';
    db.prepare('INSERT OR IGNORE INTO users (id, username, avatar_color) VALUES (?, ?, ?)').run(sysId, 'System', '#8338ec');

    const defaultGuildId = 'guild-byzantine-default';
    db.prepare(
      `INSERT OR IGNORE INTO guilds (id, name, description, image_url, created_by, is_public, invite_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(defaultGuildId, '/guild', 'The original /guild', '', sysId, 1, 'guild');

    const defaultRankRows = buildDefaultGuildRankRows(defaultGuildId);
    const rankRowsByRole = Object.fromEntries(defaultRankRows.map((row) => [row.roleKey, row]));
    const insertRank = db.prepare('INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)');
    for (const rankRow of defaultRankRows) {
      insertRank.run(rankRow.id, rankRow.guildId, rankRow.name, rankRow.rankOrder, rankRow.permissions);
    }

    db.exec(`
      CREATE TABLE rooms_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        guild_id TEXT REFERENCES guilds(id),
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(guild_id, name)
      );
    `);
    db.exec(`INSERT INTO rooms_new (id, name, guild_id, created_by, created_at)
             SELECT id, name, '${defaultGuildId}', created_by, created_at FROM rooms`);
    db.exec('DROP TABLE rooms');
    db.exec('ALTER TABLE rooms_new RENAME TO rooms');
    db.exec("CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at)");

    db.exec(`
      CREATE TABLE voice_channels_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        guild_id TEXT REFERENCES guilds(id),
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(guild_id, name)
      );
    `);
    db.exec(`INSERT INTO voice_channels_new (id, name, guild_id, created_by, created_at)
             SELECT id, name, '${defaultGuildId}', created_by, created_at FROM voice_channels`);
    db.exec('DROP TABLE voice_channels');
    db.exec('ALTER TABLE voice_channels_new RENAME TO voice_channels');
    db.exec('CREATE INDEX IF NOT EXISTS idx_voice_sessions_channel ON voice_sessions(channel_id)');

    const allUsers = db.prepare('SELECT id FROM users').all();
    const addMember = db.prepare('INSERT OR IGNORE INTO guild_members (guild_id, user_id, rank_id) VALUES (?, ?, ?)');
    for (const user of allUsers) {
      const rankId = user.id === sysId ? rankRowsByRole.guildMaster.id : rankRowsByRole.member.id;
      addMember.run(defaultGuildId, user.id, rankId);
    }
  });

  try {
    migrate();
    log.log('[DB] Guild migration complete: existing data moved to /guild');
    return true;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function enforceSingleGuildMembership({ db, log = console } = {}) {
  const multiGuildUsers = db.prepare(`
    SELECT user_id, COUNT(*) as cnt FROM guild_members GROUP BY user_id HAVING cnt > 1
  `).all();

  if (multiGuildUsers.length === 0) {
    return 0;
  }

  const cleanupTx = db.transaction(() => {
    for (const { user_id: userId } of multiGuildUsers) {
      const gmGuild = db.prepare(`
        SELECT gm.guild_id FROM guild_members gm
        JOIN guild_ranks gr ON gm.rank_id = gr.id
        WHERE gm.user_id = ? AND gr.rank_order = 0
        LIMIT 1
      `).get(userId);

      const latest = gmGuild ? null : db.prepare(`
        SELECT guild_id FROM guild_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1
      `).get(userId);

      const keepGuildId = pickGuildMembershipToKeep({
        guildMasterGuildId: gmGuild?.guild_id,
        latestGuildId: latest?.guild_id,
      });

      if (keepGuildId) {
        db.prepare('DELETE FROM guild_members WHERE user_id = ? AND guild_id != ?').run(userId, keepGuildId);
      }
    }
  });

  cleanupTx();
  log.log(`[DB] Single-guild migration: cleaned up ${multiGuildUsers.length} users with multiple guilds`);
  return multiGuildUsers.length;
}

function seedDefaultGuildInfrastructure({
  db,
  shouldSeedDefaultGuild,
  buildDefaultGuildRankRows,
} = {}) {
  if (!shouldSeedDefaultGuild) {
    return { seededRooms: 0, seededVoiceChannels: 0 };
  }

  let seededRooms = 0;
  let seededVoiceChannels = 0;

  const hasRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  if (hasRooms.count === 0) {
    const sysId = 'system-00000000-0000-0000-0000-000000000000';
    db.prepare('INSERT OR IGNORE INTO users (id, username, avatar_color) VALUES (?, ?, ?)').run(sysId, 'System', '#8338ec');
    const defaultGuildId = 'guild-byzantine-default';
    const guildExists = db.prepare('SELECT id FROM guilds WHERE id = ?').get(defaultGuildId);
    if (!guildExists) {
      db.prepare(
        `INSERT INTO guilds (id, name, description, created_by, is_public, invite_code) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(defaultGuildId, '/guild', 'The original /guild', sysId, 1, 'guild');
      const defaultRankRows = buildDefaultGuildRankRows(defaultGuildId, {
        roleKeys: ['guildMaster', 'member'],
      });
      const rankRowsByRole = Object.fromEntries(defaultRankRows.map((row) => [row.roleKey, row]));
      for (const rankRow of defaultRankRows) {
        db.prepare('INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)')
          .run(rankRow.id, rankRow.guildId, rankRow.name, rankRow.rankOrder, rankRow.permissions);
      }
      db.prepare('INSERT OR IGNORE INTO guild_members (guild_id, user_id, rank_id) VALUES (?, ?, ?)')
        .run(defaultGuildId, sysId, rankRowsByRole.guildMaster.id);
    }
    db.prepare('INSERT INTO rooms (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)').run('room-general', 'General', defaultGuildId, sysId);
    seededRooms += 1;
  }

  const hasVoice = db.prepare('SELECT COUNT(*) as count FROM voice_channels').get();
  if (hasVoice.count === 0) {
    const sysId = 'system-00000000-0000-0000-0000-000000000000';
    const defaultGuildId = 'guild-byzantine-default';
    db.prepare('INSERT OR IGNORE INTO voice_channels (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)').run('voice-general', 'General', defaultGuildId, sysId);
    seededVoiceChannels += 1;
  }

  return { seededRooms, seededVoiceChannels };
}

function renameLegacyDefaultGuild({ db } = {}) {
  try {
    db.prepare(
      `UPDATE guilds
          SET name = ?, description = ?, invite_code = ?
        WHERE id = ? AND name = ?`
    ).run('/guild', 'The original /guild', 'guild', 'guild-byzantine-default', 'Byzantine');
  } catch {}
}

module.exports = {
  migrateLegacyGuildColumns,
  enforceSingleGuildMembership,
  seedDefaultGuildInfrastructure,
  renameLegacyDefaultGuild,
};
