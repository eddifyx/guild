const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'messenger.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      avatar_color TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      content TEXT,
      sender_id TEXT NOT NULL REFERENCES users(id),
      room_id TEXT REFERENCES rooms(id),
      dm_partner_id TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (
        (room_id IS NOT NULL AND dm_partner_id IS NULL) OR
        (room_id IS NULL AND dm_partner_id IS NOT NULL)
      )
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id),
      uploaded_file_id TEXT REFERENCES uploaded_files(id),
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      stored_name TEXT NOT NULL,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      encrypted INTEGER NOT NULL DEFAULT 1,
      message_id TEXT REFERENCES messages(id),
      room_id TEXT REFERENCES rooms(id),
      dm_user_a TEXT REFERENCES users(id),
      dm_user_b TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      claimed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dm_conversations (
      user_a_id TEXT NOT NULL REFERENCES users(id),
      user_b_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_a_id, user_b_id),
      CHECK (user_a_id < user_b_id)
    );

    CREATE TABLE IF NOT EXISTS voice_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS voice_sessions (
      channel_id TEXT NOT NULL REFERENCES voice_channels(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      is_muted INTEGER NOT NULL DEFAULT 0,
      is_deafened INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (channel_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(sender_id, dm_partner_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_message ON uploaded_files(message_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_room ON uploaded_files(room_id);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_dm ON uploaded_files(dm_user_a, dm_user_b);
    CREATE INDEX IF NOT EXISTS idx_uploaded_files_owner ON uploaded_files(uploaded_by, created_at);
    CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
    CREATE TABLE IF NOT EXISTS asset_dumps (
      id TEXT PRIMARY KEY,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      description TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_voice_sessions_channel ON voice_sessions(channel_id);
    CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON voice_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_asset_dumps_expires ON asset_dumps(expires_at);

    CREATE TABLE IF NOT EXISTS addons (
      id TEXT PRIMARY KEY,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      description TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_addons_created ON addons(created_at);
  `);
}

const COLORS = [
  '#e94560', '#0f3460', '#533483', '#e94560', '#00b4d8',
  '#06d6a0', '#ffd166', '#ef476f', '#118ab2', '#073b4c',
  '#8338ec', '#ff006e'
];

// Initialize tables immediately so prepared statements can be created
initTables();

// Migrations
try { db.exec('ALTER TABLE users ADD COLUMN npub TEXT'); } catch (e) {}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_npub ON users(npub)');
try { db.exec('ALTER TABLE users ADD COLUMN lud16 TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE messages ADD COLUMN edited_at TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN profile_picture TEXT'); } catch (e) {}
try { db.exec('ALTER TABLE guilds ADD COLUMN theme_mode TEXT DEFAULT \'dark\''); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN custom_status TEXT DEFAULT \'\''); } catch (e) {}
try { db.exec("ALTER TABLE guild_members ADD COLUMN permission_overrides TEXT DEFAULT ''"); } catch (e) {}

// Make Rendir the Guild Master of /guild (one-time fix for pre-rank guild)
try {
  const rendir = db.prepare("SELECT id FROM users WHERE username = 'Rendir'").get();
  const gmRankId = 'rank-guild-byzantine-default-0';
  if (rendir) {
    db.prepare('UPDATE guild_members SET rank_id = ? WHERE guild_id = ? AND user_id = ?')
      .run(gmRankId, 'guild-byzantine-default', rendir.id);
  }
} catch (e) { /* guild tables may not exist yet on fresh DB */ }

// E2E Encryption key storage tables
try { db.exec('ALTER TABLE messages ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0'); } catch (e) {}
try { db.exec('ALTER TABLE attachments ADD COLUMN uploaded_file_id TEXT REFERENCES uploaded_files(id)'); } catch (e) {}
try { db.exec('ALTER TABLE identity_keys ADD COLUMN bundle_signature_event TEXT'); } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS uploaded_files (
    id TEXT PRIMARY KEY,
    stored_name TEXT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    encrypted INTEGER NOT NULL DEFAULT 1,
    message_id TEXT REFERENCES messages(id),
    room_id TEXT REFERENCES rooms(id),
    dm_user_a TEXT REFERENCES users(id),
    dm_user_b TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    claimed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_uploaded_files_message ON uploaded_files(message_id);
  CREATE INDEX IF NOT EXISTS idx_uploaded_files_room ON uploaded_files(room_id);
  CREATE INDEX IF NOT EXISTS idx_uploaded_files_dm ON uploaded_files(dm_user_a, dm_user_b);
  CREATE INDEX IF NOT EXISTS idx_uploaded_files_owner ON uploaded_files(uploaded_by, created_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS identity_keys (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    identity_key_public TEXT NOT NULL,
    signing_key_public TEXT NOT NULL,
    registration_id INTEGER NOT NULL,
    bundle_signature_event TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS signed_prekeys (
    user_id TEXT NOT NULL REFERENCES users(id),
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    signature TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, key_id)
  );

  CREATE TABLE IF NOT EXISTS one_time_prekeys (
    user_id TEXT NOT NULL REFERENCES users(id),
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, key_id)
  );

  CREATE INDEX IF NOT EXISTS idx_otp_available ON one_time_prekeys(user_id, used);

  CREATE TABLE IF NOT EXISTS kyber_prekeys (
    user_id TEXT NOT NULL REFERENCES users(id),
    key_id INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    signature TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, key_id)
  );
  CREATE INDEX IF NOT EXISTS idx_kyber_available ON kyber_prekeys(user_id, used);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

// ---------------------------------------------------------------------------
// Guild system tables
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    banner_url TEXT DEFAULT '',
    accent_color TEXT DEFAULT '#ff6b00',
    bg_color TEXT DEFAULT '#0a0a0a',
    motd TEXT DEFAULT '',
    created_by TEXT NOT NULL REFERENCES users(id),
    is_public INTEGER DEFAULT 1,
    invite_code TEXT UNIQUE,
    ranking_score REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS guild_ranks (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL REFERENCES guilds(id),
    name TEXT NOT NULL DEFAULT 'Member',
    rank_order INTEGER NOT NULL DEFAULT 0,
    permissions TEXT NOT NULL DEFAULT '{}',
    UNIQUE(guild_id, rank_order)
  );

  CREATE TABLE IF NOT EXISTS guild_members (
    guild_id TEXT NOT NULL REFERENCES guilds(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    rank_id TEXT NOT NULL REFERENCES guild_ranks(id),
    public_note TEXT DEFAULT '',
    officer_note TEXT DEFAULT '',
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_guild_ranks_guild ON guild_ranks(guild_id);
`);

// ---------------------------------------------------------------------------
// Guild migration: add guild_id to rooms & voice_channels, create default guild
// ---------------------------------------------------------------------------
{
  // Check if rooms already has guild_id column
  const roomCols = db.prepare("PRAGMA table_info(rooms)").all();
  const hasGuildId = roomCols.some(c => c.name === 'guild_id');

  if (!hasGuildId) {
    // Temporarily disable FK checks for table recreation
    db.pragma('foreign_keys = OFF');
    const migrate = db.transaction(() => {
      const sysId = 'system-00000000-0000-0000-0000-000000000000';
      db.prepare('INSERT OR IGNORE INTO users (id, username, avatar_color) VALUES (?, ?, ?)').run(sysId, 'System', '#8338ec');

      // Create default /guild
      const defaultGuildId = 'guild-byzantine-default';
      db.prepare(
        `INSERT OR IGNORE INTO guilds (id, name, description, image_url, created_by, is_public, invite_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(defaultGuildId, '/guild', 'The original /guild', '', sysId, 1, 'guild');

      // Create default ranks for /guild
      const defaultPerms = {
        guildMaster: JSON.stringify({
          invite_member: true, remove_member: true, promote_demote: true, manage_applications: true,
          guild_chat_speak: true, guild_chat_listen: true, officer_chat: true, modify_motd: true,
          create_delete_events: true, edit_public_note: true, edit_officer_note: true, view_officer_note: true,
          view_asset_dump: true, upload_files: true, download_files: true, delete_files: true, manage_storage: true,
          modify_rank_names: true, set_permissions: true, manage_rooms: true, manage_theme: true,
          disband_guild: true, transfer_leadership: true,
        }),
        officer: JSON.stringify({
          invite_member: true, remove_member: true, promote_demote: true, manage_applications: true,
          guild_chat_speak: true, guild_chat_listen: true, officer_chat: true, modify_motd: false,
          create_delete_events: true, edit_public_note: true, edit_officer_note: true, view_officer_note: true,
          view_asset_dump: true, upload_files: true, download_files: true, delete_files: true, manage_storage: true,
          modify_rank_names: false, set_permissions: false, manage_rooms: true, manage_theme: true,
          disband_guild: false, transfer_leadership: false,
        }),
        veteran: JSON.stringify({
          invite_member: true, remove_member: false, promote_demote: false, manage_applications: false,
          guild_chat_speak: true, guild_chat_listen: true, officer_chat: false, modify_motd: false,
          create_delete_events: false, edit_public_note: true, edit_officer_note: false, view_officer_note: false,
          view_asset_dump: true, upload_files: true, download_files: true, delete_files: false, manage_storage: false,
          modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
          disband_guild: false, transfer_leadership: false,
        }),
        member: JSON.stringify({
          invite_member: false, remove_member: false, promote_demote: false, manage_applications: false,
          guild_chat_speak: true, guild_chat_listen: true, officer_chat: false, modify_motd: false,
          create_delete_events: false, edit_public_note: true, edit_officer_note: false, view_officer_note: false,
          view_asset_dump: true, upload_files: false, download_files: true, delete_files: false, manage_storage: false,
          modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
          disband_guild: false, transfer_leadership: false,
        }),
        initiate: JSON.stringify({
          invite_member: false, remove_member: false, promote_demote: false, manage_applications: false,
          guild_chat_speak: false, guild_chat_listen: true, officer_chat: false, modify_motd: false,
          create_delete_events: false, edit_public_note: false, edit_officer_note: false, view_officer_note: false,
          view_asset_dump: true, upload_files: false, download_files: false, delete_files: false, manage_storage: false,
          modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
          disband_guild: false, transfer_leadership: false,
        }),
      };

      const rankIds = {
        guildMaster: `rank-${defaultGuildId}-0`,
        officer: `rank-${defaultGuildId}-1`,
        veteran: `rank-${defaultGuildId}-2`,
        member: `rank-${defaultGuildId}-3`,
        initiate: `rank-${defaultGuildId}-4`,
      };

      const insertRank = db.prepare('INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)');
      insertRank.run(rankIds.guildMaster, defaultGuildId, 'Guild Master', 0, defaultPerms.guildMaster);
      insertRank.run(rankIds.officer, defaultGuildId, 'Officer', 1, defaultPerms.officer);
      insertRank.run(rankIds.veteran, defaultGuildId, 'Veteran', 2, defaultPerms.veteran);
      insertRank.run(rankIds.member, defaultGuildId, 'Member', 3, defaultPerms.member);
      insertRank.run(rankIds.initiate, defaultGuildId, 'Initiate', 4, defaultPerms.initiate);

      // Recreate rooms with guild_id column
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
      db.exec('CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at)');

      // Recreate voice_channels with guild_id column
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

      // Add all existing users as members of the default guild with "Member" rank
      const allUsers = db.prepare('SELECT id FROM users').all();
      const addMember = db.prepare('INSERT OR IGNORE INTO guild_members (guild_id, user_id, rank_id) VALUES (?, ?, ?)');
      for (const u of allUsers) {
        // System user gets Guild Master, everyone else gets Member
        const rid = u.id === sysId ? rankIds.guildMaster : rankIds.member;
        addMember.run(defaultGuildId, u.id, rid);
      }
    });

    migrate();
    db.pragma('foreign_keys = ON');
    console.log('[DB] Guild migration complete ??? existing data moved to /guild');
  }
}

// ---------------------------------------------------------------------------
// Single-guild migration: ensure each user is in at most 1 guild
// ---------------------------------------------------------------------------
{
  const multiGuildUsers = db.prepare(`
    SELECT user_id, COUNT(*) as cnt FROM guild_members GROUP BY user_id HAVING cnt > 1
  `).all();

  if (multiGuildUsers.length > 0) {
    const cleanupTx = db.transaction(() => {
      for (const { user_id } of multiGuildUsers) {
        // Prefer guild where user is Guild Master (rank_order = 0)
        const gmGuild = db.prepare(`
          SELECT gm.guild_id FROM guild_members gm
          JOIN guild_ranks gr ON gm.rank_id = gr.id
          WHERE gm.user_id = ? AND gr.rank_order = 0
          LIMIT 1
        `).get(user_id);

        let keepGuildId;
        if (gmGuild) {
          keepGuildId = gmGuild.guild_id;
        } else {
          // Keep most recently joined guild
          const latest = db.prepare(`
            SELECT guild_id FROM guild_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1
          `).get(user_id);
          keepGuildId = latest.guild_id;
        }

        // Remove all other memberships
        db.prepare('DELETE FROM guild_members WHERE user_id = ? AND guild_id != ?').run(user_id, keepGuildId);
      }
    });
    cleanupTx();
    console.log(`[DB] Single-guild migration: cleaned up ${multiGuildUsers.length} users with multiple guilds`);
  }
}

// Seed default General room and voice channel on first run
{
  const hasRooms = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
  if (hasRooms.count === 0) {
    const sysId = 'system-00000000-0000-0000-0000-000000000000';
    db.prepare('INSERT OR IGNORE INTO users (id, username, avatar_color) VALUES (?, ?, ?)').run(sysId, 'System', '#8338ec');
    // Ensure default guild exists for seeding
    const defaultGuildId = 'guild-byzantine-default';
    const guildExists = db.prepare('SELECT id FROM guilds WHERE id = ?').get(defaultGuildId);
    if (!guildExists) {
      db.prepare(
        `INSERT INTO guilds (id, name, description, created_by, is_public, invite_code) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(defaultGuildId, '/guild', 'The original /guild', sysId, 1, 'guild');
      // Create default ranks
      const memberPerms = JSON.stringify({
        invite_member: false, remove_member: false, promote_demote: false, manage_applications: false,
        guild_chat_speak: true, guild_chat_listen: true, officer_chat: false, modify_motd: false,
        create_delete_events: false, edit_public_note: true, edit_officer_note: false, view_officer_note: false,
        view_asset_dump: true, upload_files: false, download_files: true, delete_files: false, manage_storage: false,
        modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
        disband_guild: false, transfer_leadership: false,
      });
      const gmPerms = JSON.stringify({
        invite_member: true, remove_member: true, promote_demote: true, manage_applications: true,
        guild_chat_speak: true, guild_chat_listen: true, officer_chat: true, modify_motd: true,
        create_delete_events: true, edit_public_note: true, edit_officer_note: true, view_officer_note: true,
        view_asset_dump: true, upload_files: true, download_files: true, delete_files: true, manage_storage: true,
        modify_rank_names: true, set_permissions: true, manage_rooms: true, manage_theme: true,
        disband_guild: true, transfer_leadership: true,
      });
      db.prepare('INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)').run(`rank-${defaultGuildId}-0`, defaultGuildId, 'Guild Master', 0, gmPerms);
      db.prepare('INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)').run(`rank-${defaultGuildId}-3`, defaultGuildId, 'Member', 3, memberPerms);
      db.prepare('INSERT OR IGNORE INTO guild_members (guild_id, user_id, rank_id) VALUES (?, ?, ?)').run(defaultGuildId, sysId, `rank-${defaultGuildId}-0`);
    }
    db.prepare('INSERT INTO rooms (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)').run('room-general', 'General', defaultGuildId, sysId);
  }
  const hasVoice = db.prepare('SELECT COUNT(*) as count FROM voice_channels').get();
  if (hasVoice.count === 0) {
    const sysId = 'system-00000000-0000-0000-0000-000000000000';
    const defaultGuildId = 'guild-byzantine-default';
    db.prepare('INSERT OR IGNORE INTO voice_channels (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)').run('voice-general', 'General', defaultGuildId, sysId);
  }
}

try {
  db.prepare(
    `UPDATE guilds
        SET name = ?, description = ?, invite_code = ?
      WHERE id = ? AND name = ?`
  ).run('/guild', 'The original /guild', 'guild', 'guild-byzantine-default', 'Byzantine');
} catch (e) {}

function hashColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

// User helpers
const createUser = db.prepare(
  'INSERT INTO users (id, username, avatar_color) VALUES (?, ?, ?)'
);
const getUserByUsername = db.prepare('SELECT * FROM users WHERE username = ?');
const getUserById = db.prepare('SELECT * FROM users WHERE id = ?');
const getAllUsers = db.prepare('SELECT id, username, avatar_color, last_seen, npub, lud16 FROM users ORDER BY username');
const updateLastSeen = db.prepare('UPDATE users SET last_seen = datetime(\'now\') WHERE id = ?');
const getUserByNpub = db.prepare('SELECT * FROM users WHERE npub = ?');
const createUserWithNpub = db.prepare(
  'INSERT INTO users (id, username, avatar_color, npub, lud16, profile_picture) VALUES (?, ?, ?, ?, ?, ?)'
);
const updateUserLud16 = db.prepare('UPDATE users SET lud16 = ? WHERE id = ?');
const updateUserProfilePicture = db.prepare('UPDATE users SET profile_picture = ? WHERE id = ?');
const updateUserStatus = db.prepare('UPDATE users SET custom_status = ? WHERE id = ?');

// Room helpers
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

// Message helpers
const insertMessage = db.prepare(
  'INSERT INTO messages (id, content, sender_id, room_id, dm_partner_id, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))'
);
const insertAttachment = db.prepare(
  'INSERT INTO attachments (id, message_id, uploaded_file_id, file_url, file_name, file_type, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const insertUploadedFile = db.prepare(
  'INSERT INTO uploaded_files (id, stored_name, uploaded_by, file_name, file_type, file_size, encrypted) VALUES (?, ?, ?, ?, ?, ?, ?)'
);
const getUploadedFileById = db.prepare('SELECT * FROM uploaded_files WHERE id = ?');
const getUploadedFileByStoredName = db.prepare('SELECT * FROM uploaded_files WHERE stored_name = ?');
const getUploadedFilesByMessageId = db.prepare('SELECT * FROM uploaded_files WHERE message_id = ?');
const getOwnedUnclaimedUploadedFile = db.prepare(
  'SELECT * FROM uploaded_files WHERE id = ? AND uploaded_by = ? AND message_id IS NULL'
);
const claimUploadedFileForRoomMessage = db.prepare(
  "UPDATE uploaded_files SET message_id = ?, room_id = ?, dm_user_a = NULL, dm_user_b = NULL, claimed_at = datetime('now') WHERE id = ? AND uploaded_by = ? AND message_id IS NULL"
);
const claimUploadedFileForDMMessage = db.prepare(
  "UPDATE uploaded_files SET message_id = ?, room_id = NULL, dm_user_a = ?, dm_user_b = ?, claimed_at = datetime('now') WHERE id = ? AND uploaded_by = ? AND message_id IS NULL"
);
const deleteUploadedFileRecord = db.prepare('DELETE FROM uploaded_files WHERE id = ?');
const getExpiredUnclaimedUploadedFiles = db.prepare(
  "SELECT * FROM uploaded_files WHERE message_id IS NULL AND created_at <= datetime('now', '-1 day')"
);
const deleteExpiredUnclaimedUploadedFiles = db.prepare(
  "DELETE FROM uploaded_files WHERE message_id IS NULL AND created_at <= datetime('now', '-1 day')"
);

const getMessageById = db.prepare('SELECT * FROM messages WHERE id = ?');
const updateMessageContent = db.prepare(
  "UPDATE messages SET content = ?, edited_at = datetime('now') WHERE id = ? AND sender_id = ?"
);
const deleteMessage = db.prepare('DELETE FROM messages WHERE id = ? AND sender_id = ?');
const deleteMessageAttachments = db.prepare('DELETE FROM attachments WHERE message_id = ?');
const getMessageAttachments = db.prepare('SELECT * FROM attachments WHERE message_id = ?');

function getRoomMessages(roomId, before, limit = 50) {
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
  const map = {};
  for (const row of rows) {
    if (!map[row.message_id]) map[row.message_id] = [];
    map[row.message_id].push(row);
  }
  return map;
}

// DM conversation helpers
const ensureDMConversation = db.prepare(
  'INSERT OR IGNORE INTO dm_conversations (user_a_id, user_b_id) VALUES (?, ?)'
);

const deleteDMConversation = db.prepare(
  'DELETE FROM dm_conversations WHERE (user_a_id = ? AND user_b_id = ?) OR (user_a_id = ? AND user_b_id = ?)'
);

function getDMConversations(userId) {
  return db.prepare(`
    SELECT dc.*,
      CASE WHEN dc.user_a_id = ? THEN dc.user_b_id ELSE dc.user_a_id END as other_user_id,
      u.username as other_username, u.avatar_color as other_avatar_color, u.last_seen as other_last_seen, u.npub as other_npub
    FROM dm_conversations dc
    JOIN users u ON u.id = CASE WHEN dc.user_a_id = ? THEN dc.user_b_id ELSE dc.user_a_id END
    WHERE dc.user_a_id = ? OR dc.user_b_id = ?
    ORDER BY dc.created_at DESC
  `).all(userId, userId, userId, userId)
    .filter((conversation) => !!usersShareGuild.get(userId, conversation.other_user_id));
}

// Voice channel helpers
const createVoiceChannel = db.prepare('INSERT INTO voice_channels (id, name, guild_id, created_by) VALUES (?, ?, ?, ?)');
const getAllVoiceChannels = db.prepare('SELECT * FROM voice_channels ORDER BY created_at');
const getVoiceChannelsByGuild = db.prepare('SELECT * FROM voice_channels WHERE guild_id = ? ORDER BY created_at');
const getVoiceChannelById = db.prepare('SELECT * FROM voice_channels WHERE id = ?');
const deleteVoiceChannel = db.prepare('DELETE FROM voice_channels WHERE id = ?');

// Voice session helpers
const addVoiceSession = db.prepare('INSERT OR REPLACE INTO voice_sessions (channel_id, user_id) VALUES (?, ?)');
const removeVoiceSession = db.prepare('DELETE FROM voice_sessions WHERE channel_id = ? AND user_id = ?');
const clearChannelVoiceSessions = db.prepare('DELETE FROM voice_sessions WHERE channel_id = ?');
const removeUserFromAllVoiceChannels = db.prepare('DELETE FROM voice_sessions WHERE user_id = ?');
const getVoiceChannelParticipants = db.prepare(`
  SELECT vs.*, u.username, u.avatar_color, u.npub
  FROM voice_sessions vs JOIN users u ON vs.user_id = u.id
  WHERE vs.channel_id = ? ORDER BY vs.joined_at
`);
const getUserVoiceSession = db.prepare('SELECT * FROM voice_sessions WHERE user_id = ?');
const clearAllVoiceSessions = db.prepare('DELETE FROM voice_sessions');
const updateVoiceMuteState = db.prepare(
  'UPDATE voice_sessions SET is_muted = ?, is_deafened = ? WHERE channel_id = ? AND user_id = ?'
);

// Asset dump helpers
const insertAssetDump = db.prepare(
  `INSERT INTO asset_dumps (id, file_url, file_name, file_type, file_size, description, uploaded_by, expires_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+5 days'))`
);
const getAllAssetDumps = db.prepare(`
  SELECT ad.*, u.username as uploader_name, u.avatar_color as uploader_color
  FROM asset_dumps ad JOIN users u ON ad.uploaded_by = u.id
  WHERE ad.expires_at > datetime('now')
  ORDER BY ad.created_at DESC
`);
const getAssetDumpById = db.prepare('SELECT * FROM asset_dumps WHERE id = ?');
const deleteAssetDump = db.prepare('DELETE FROM asset_dumps WHERE id = ?');
const getExpiredAssetDumps = db.prepare(
  `SELECT id, file_url FROM asset_dumps WHERE expires_at <= datetime('now')`
);
const deleteExpiredAssetDumps = db.prepare(
  `DELETE FROM asset_dumps WHERE expires_at <= datetime('now')`
);

// E2E Encryption key helpers
const upsertIdentityKey = db.prepare(
  `INSERT INTO identity_keys (user_id, identity_key_public, signing_key_public, registration_id, bundle_signature_event)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(user_id) DO UPDATE SET
     identity_key_public = excluded.identity_key_public,
     signing_key_public = excluded.signing_key_public,
     registration_id = excluded.registration_id,
     bundle_signature_event = excluded.bundle_signature_event,
     updated_at = datetime('now')`
);
const getIdentityKey = db.prepare('SELECT * FROM identity_keys WHERE user_id = ?');

const upsertSignedPreKey = db.prepare(
  `INSERT INTO signed_prekeys (user_id, key_id, public_key, signature)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(user_id, key_id) DO UPDATE SET
     public_key = excluded.public_key,
     signature = excluded.signature,
     created_at = datetime('now')`
);
const getLatestSignedPreKey = db.prepare(
  'SELECT * FROM signed_prekeys WHERE user_id = ? ORDER BY key_id DESC LIMIT 1'
);

const insertOneTimePreKey = db.prepare(
  'INSERT OR IGNORE INTO one_time_prekeys (user_id, key_id, public_key) VALUES (?, ?, ?)'
);

const getAndClaimOneTimePreKey = db.transaction((userId) => {
  const key = db.prepare(
    'SELECT * FROM one_time_prekeys WHERE user_id = ? AND used = 0 ORDER BY key_id LIMIT 1'
  ).get(userId);
  if (key) {
    db.prepare('UPDATE one_time_prekeys SET used = 1 WHERE user_id = ? AND key_id = ?')
      .run(userId, key.key_id);
  }
  return key || null;
});

const countAvailableOTPs = db.prepare(
  'SELECT COUNT(*) as count FROM one_time_prekeys WHERE user_id = ? AND used = 0'
);

// Kyber prekey helpers
const insertKyberPreKey = db.prepare(
  'INSERT OR IGNORE INTO kyber_prekeys (user_id, key_id, public_key, signature) VALUES (?, ?, ?, ?)'
);

const getAndClaimKyberPreKey = db.transaction((userId) => {
  const key = db.prepare(
    'SELECT * FROM kyber_prekeys WHERE user_id = ? AND used = 0 ORDER BY key_id LIMIT 1'
  ).get(userId);
  if (key) {
    db.prepare('UPDATE kyber_prekeys SET used = 1 WHERE user_id = ? AND key_id = ?')
      .run(userId, key.key_id);
  }
  return key || null;
});

const countAvailableKyberPreKeys = db.prepare(
  'SELECT COUNT(*) as count FROM kyber_prekeys WHERE user_id = ? AND used = 0'
);

// Reset all encryption keys for a user (for fresh client re-registration)
const deleteUserIdentityKey = db.prepare('DELETE FROM identity_keys WHERE user_id = ?');
const deleteUserSignedPreKeys = db.prepare('DELETE FROM signed_prekeys WHERE user_id = ?');
const deleteUserOneTimePreKeys = db.prepare('DELETE FROM one_time_prekeys WHERE user_id = ?');
const deleteUserKyberPreKeys = db.prepare('DELETE FROM kyber_prekeys WHERE user_id = ?');
const resetUserKeys = db.transaction((userId) => {
  deleteUserIdentityKey.run(userId);
  deleteUserSignedPreKeys.run(userId);
  deleteUserOneTimePreKeys.run(userId);
  deleteUserKyberPreKeys.run(userId);
});

const insertEncryptedMessage = db.prepare(
  "INSERT INTO messages (id, content, sender_id, room_id, dm_partner_id, encrypted, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
);

// Session helpers
const createSession = db.prepare(
  "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"
);
const getSession = db.prepare(
  "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now')"
);
const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');
const deleteUserSessions = db.prepare('DELETE FROM sessions WHERE user_id = ?');
const deleteExpiredSessions = db.prepare(
  "DELETE FROM sessions WHERE expires_at <= datetime('now')"
);

// Addon helpers (permanent storage â€” no expiry)
const insertAddon = db.prepare(
  `INSERT INTO addons (id, file_url, file_name, file_type, file_size, description, uploaded_by)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const getAllAddons = db.prepare(`
  SELECT a.*, u.username as uploader_name, u.avatar_color as uploader_color
  FROM addons a JOIN users u ON a.uploaded_by = u.id
  ORDER BY a.created_at DESC
`);
const getAddonById = db.prepare('SELECT * FROM addons WHERE id = ?');
const deleteAddon = db.prepare('DELETE FROM addons WHERE id = ?');

// ---------------------------------------------------------------------------
// Guild helpers
// ---------------------------------------------------------------------------
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

// Guild rank helpers
const createGuildRank = db.prepare(
  'INSERT INTO guild_ranks (id, guild_id, name, rank_order, permissions) VALUES (?, ?, ?, ?, ?)'
);
const getGuildRanks = db.prepare('SELECT * FROM guild_ranks WHERE guild_id = ? ORDER BY rank_order');
const getGuildRankById = db.prepare('SELECT * FROM guild_ranks WHERE id = ?');
const updateGuildRank = db.prepare('UPDATE guild_ranks SET name = ?, permissions = ? WHERE id = ?');
const deleteGuildRank = db.prepare('DELETE FROM guild_ranks WHERE id = ?');
const getLowestRank = db.prepare('SELECT * FROM guild_ranks WHERE guild_id = ? ORDER BY rank_order DESC LIMIT 1');

// Guild member helpers
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
const backfillGuildRoomMemberships = db.transaction(() => {
  const guilds = db.prepare('SELECT id FROM guilds').all();
  for (const { id: guildId } of guilds) {
    const rooms = getRoomsByGuild.all(guildId);
    if (rooms.length === 0) continue;
    const members = getGuildMembers.all(guildId);
    for (const member of members) {
      for (const room of rooms) {
        addRoomMember.run(room.id, member.id);
      }
    }
  }
});


// Default permission templates for creating new guild ranks
const DEFAULT_RANK_PERMISSIONS = {
  guildMaster: {
    invite_member: true, remove_member: true, promote_demote: true, manage_applications: true,
    guild_chat_speak: true, guild_chat_listen: true, officer_chat: true, modify_motd: true,
    create_delete_events: true, edit_public_note: true, edit_officer_note: true, view_officer_note: true,
    view_asset_dump: true, upload_files: true, download_files: true, delete_files: true, manage_storage: true,
    modify_rank_names: true, set_permissions: true, manage_rooms: true, manage_theme: true,
    disband_guild: true, transfer_leadership: true,
  },
  officer: {
    invite_member: true, remove_member: true, promote_demote: true, manage_applications: true,
    guild_chat_speak: true, guild_chat_listen: true, officer_chat: true, modify_motd: false,
    create_delete_events: true, edit_public_note: true, edit_officer_note: true, view_officer_note: true,
    view_asset_dump: true, upload_files: true, download_files: true, delete_files: true, manage_storage: true,
    modify_rank_names: false, set_permissions: false, manage_rooms: true, manage_theme: true,
    disband_guild: false, transfer_leadership: false,
  },
  veteran: {
    invite_member: true, remove_member: false, promote_demote: false, manage_applications: false,
    guild_chat_speak: true, guild_chat_listen: true, officer_chat: false, modify_motd: false,
    create_delete_events: false, edit_public_note: true, edit_officer_note: false, view_officer_note: false,
    view_asset_dump: true, upload_files: true, download_files: true, delete_files: false, manage_storage: false,
    modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
    disband_guild: false, transfer_leadership: false,
  },
  member: {
    invite_member: false, remove_member: false, promote_demote: false, manage_applications: false,
    guild_chat_speak: true, guild_chat_listen: true, officer_chat: false, modify_motd: false,
    create_delete_events: false, edit_public_note: true, edit_officer_note: false, view_officer_note: false,
    view_asset_dump: true, upload_files: false, download_files: true, delete_files: false, manage_storage: false,
    modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
    disband_guild: false, transfer_leadership: false,
  },
  initiate: {
    invite_member: false, remove_member: false, promote_demote: false, manage_applications: false,
    guild_chat_speak: false, guild_chat_listen: true, officer_chat: false, modify_motd: false,
    create_delete_events: false, edit_public_note: false, edit_officer_note: false, view_officer_note: false,
    view_asset_dump: true, upload_files: false, download_files: false, delete_files: false, manage_storage: false,
    modify_rank_names: false, set_permissions: false, manage_rooms: false, manage_theme: false,
    disband_guild: false, transfer_leadership: false,
  },
};

// Keep room membership consistent with the single-guild model:
// every guild member should automatically belong to every room in that guild.
backfillGuildRoomMemberships();

// ---------------------------------------------------------------------------
// Contacts table â€” server-side contact list (replaces unreliable Nostr kind:3)
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    user_id TEXT NOT NULL REFERENCES users(id),
    contact_npub TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, contact_npub)
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
`);

const getContactsByUser = db.prepare(
  'SELECT contact_npub, display_name, added_at FROM contacts WHERE user_id = ? ORDER BY added_at DESC'
);
const addContact = db.prepare(
  'INSERT OR IGNORE INTO contacts (user_id, contact_npub, display_name) VALUES (?, ?, ?)'
);
const removeContact = db.prepare(
  'DELETE FROM contacts WHERE user_id = ? AND contact_npub = ?'
);
const getVisibleGuildmateIds = db.prepare(
  `SELECT DISTINCT gm_other.user_id AS user_id
   FROM guild_members gm_self
   JOIN guild_members gm_other ON gm_self.guild_id = gm_other.guild_id
   WHERE gm_self.user_id = ?`
);
const getVisibleContactUserIds = db.prepare(
  `SELECT DISTINCT u.id AS user_id
   FROM contacts c
   JOIN users u ON u.npub = c.contact_npub
   WHERE c.user_id = ?`
);
function getVisibleUserIds(userId) {
  const visible = new Set();
  if (userId) visible.add(userId);

  for (const row of getVisibleGuildmateIds.all(userId)) {
    if (row?.user_id) visible.add(row.user_id);
  }
  for (const row of getVisibleContactUserIds.all(userId)) {
    if (row?.user_id) visible.add(row.user_id);
  }

  return visible;
}

function getVisibleUsers(userId) {
  return Array.from(getVisibleUserIds(userId))
    .map((id) => getUserById.get(id))
    .filter((user) => user && !user.id.startsWith('system-'))
    .sort((a, b) => a.username.localeCompare(b.username));
}

// ---------------------------------------------------------------------------
// Friend requests â€” send/accept/reject before becoming mutual friends
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS friend_requests (
    id TEXT PRIMARY KEY,
    from_user_id TEXT NOT NULL REFERENCES users(id),
    to_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(from_user_id, to_user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_fr_to ON friend_requests(to_user_id, status);
  CREATE INDEX IF NOT EXISTS idx_fr_from ON friend_requests(from_user_id, status);
`);

const createFriendRequest = db.prepare(
  'INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)'
);
const getPendingRequestsForUser = db.prepare(`
  SELECT fr.id, fr.from_user_id, fr.created_at,
         u.username AS from_username, u.npub AS from_npub,
         u.avatar_color AS from_color, u.profile_picture AS from_picture
  FROM friend_requests fr
  JOIN users u ON fr.from_user_id = u.id
  WHERE fr.to_user_id = ? AND fr.status = 'pending'
  ORDER BY fr.created_at DESC
`);
const getSentRequests = db.prepare(`
  SELECT fr.id, fr.to_user_id, fr.created_at, u.npub AS to_npub
  FROM friend_requests fr
  JOIN users u ON fr.to_user_id = u.id
  WHERE fr.from_user_id = ? AND fr.status = 'pending'
`);
const getFriendRequest = db.prepare(
  'SELECT * FROM friend_requests WHERE id = ?'
);
const getPendingBetween = db.prepare(
  "SELECT * FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'"
);
const acceptFriendRequest = db.prepare(
  "UPDATE friend_requests SET status = 'accepted' WHERE id = ?"
);
const deleteFriendRequest = db.prepare(
  'DELETE FROM friend_requests WHERE id = ?'
);

// Session token hashing â€” tokens are stored as SHA-256 hashes so a DB
// compromise doesn't leak usable session credentials.
const crypto = require('crypto');
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  hashToken,
  db,
  initTables,
  hashColor,
  createUser,
  getUserByUsername,
  getUserById,
  getAllUsers,
  updateLastSeen,
  updateUserStatus,
  createRoom,
  getAllRooms,
  getRoomById,
  getRoomsByGuild,
  addRoomMember,
  removeRoomMember,
  getRoomMembers,
  getUserRooms,
  isRoomMember,
  renameRoom,
  deleteRoomRow,
  deleteRoomMembers,
  deleteRoomAttachments,
  deleteRoomMessages,
  insertMessage,
  insertAttachment,
  insertUploadedFile,
  getUploadedFileById,
  getUploadedFileByStoredName,
  getUploadedFilesByMessageId,
  getOwnedUnclaimedUploadedFile,
  claimUploadedFileForRoomMessage,
  claimUploadedFileForDMMessage,
  deleteUploadedFileRecord,
  getExpiredUnclaimedUploadedFiles,
  deleteExpiredUnclaimedUploadedFiles,
  getRoomMessages,
  getDMMessages,
  getAttachmentsForMessages,
  ensureDMConversation,
  deleteDMConversation,
  getDMConversations,
  createVoiceChannel,
  getAllVoiceChannels,
  getVoiceChannelById,
  getVoiceChannelsByGuild,
  deleteVoiceChannel,
  addVoiceSession,
  removeVoiceSession,
  clearChannelVoiceSessions,
  removeUserFromAllVoiceChannels,
  getVoiceChannelParticipants,
  getUserVoiceSession,
  clearAllVoiceSessions,
  updateVoiceMuteState,
  insertAssetDump,
  getAllAssetDumps,
  getAssetDumpById,
  deleteAssetDump,
  getExpiredAssetDumps,
  deleteExpiredAssetDumps,
  insertAddon,
  getAllAddons,
  getAddonById,
  deleteAddon,
  getUserByNpub,
  createUserWithNpub,
  updateUserLud16,
  updateUserProfilePicture,
  getMessageById,
  updateMessageContent,
  deleteMessage,
  deleteMessageAttachments,
  getMessageAttachments,
  upsertIdentityKey,
  getIdentityKey,
  upsertSignedPreKey,
  getLatestSignedPreKey,
  insertOneTimePreKey,
  getAndClaimOneTimePreKey,
  countAvailableOTPs,
  insertEncryptedMessage,
  resetUserKeys,
  insertKyberPreKey,
  getAndClaimKyberPreKey,
  countAvailableKyberPreKeys,
  createSession,
  getSession,
  deleteSession,
  deleteUserSessions,
  deleteExpiredSessions,
  // Guild system
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
  getGuildRankById,
  updateGuildRank,
  deleteGuildRank,
  getLowestRank,
  addGuildMember,
  removeGuildMember,
  addUserToGuildRooms,
  removeUserFromGuildRooms,
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
  DEFAULT_RANK_PERMISSIONS,
  // Contacts
  getContactsByUser,
  addContact,
  removeContact,
  getVisibleUserIds,
  getVisibleUsers,
  // Friend requests
  createFriendRequest,
  getPendingRequestsForUser,
  getSentRequests,
  getFriendRequest,
  getPendingBetween,
  acceptFriendRequest,
  deleteFriendRequest,
};
