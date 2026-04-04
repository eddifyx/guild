const CORE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    guild_id TEXT REFERENCES guilds(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, name)
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
    name TEXT NOT NULL,
    guild_id TEXT REFERENCES guilds(id),
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(guild_id, name)
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
`;

const SOCIAL_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS contacts (
    user_id TEXT NOT NULL REFERENCES users(id),
    contact_npub TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    added_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, contact_npub)
  );
  CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

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
`;

function initCoreTables({ db } = {}) {
  db.exec(CORE_SCHEMA_SQL);
}

function initSocialTables({ db } = {}) {
  db.exec(SOCIAL_SCHEMA_SQL);
}

function initTables({ db } = {}) {
  initCoreTables({ db });
  initSocialTables({ db });
}

module.exports = {
  CORE_SCHEMA_SQL,
  SOCIAL_SCHEMA_SQL,
  initCoreTables,
  initSocialTables,
  initTables,
};
