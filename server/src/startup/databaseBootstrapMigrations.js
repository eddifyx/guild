const { usersTableHasUniqueUsernameConstraint } = require('./databaseBootstrapModel');

function migrateUsersToAllowDuplicateUsernames({ db, log = console } = {}) {
  if (!usersTableHasUniqueUsernameConstraint({ db })) {
    return false;
  }

  const userColumns = new Set(
    db.prepare('PRAGMA table_info(users)').all().map((column) => column.name)
  );

  db.pragma('foreign_keys = OFF');
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        avatar_color TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen TEXT,
        npub TEXT,
        lud16 TEXT,
        profile_picture TEXT,
        custom_status TEXT DEFAULT ''
      );
    `);

    const createdAtExpr = userColumns.has('created_at') ? 'created_at' : "datetime('now')";
    const lastSeenExpr = userColumns.has('last_seen') ? 'last_seen' : 'NULL';
    const npubExpr = userColumns.has('npub') ? 'npub' : 'NULL';
    const lud16Expr = userColumns.has('lud16') ? 'lud16' : 'NULL';
    const profilePictureExpr = userColumns.has('profile_picture') ? 'profile_picture' : 'NULL';
    const customStatusExpr = userColumns.has('custom_status') ? 'custom_status' : "''";

    db.exec(`
      INSERT INTO users_new (
        id,
        username,
        avatar_color,
        created_at,
        last_seen,
        npub,
        lud16,
        profile_picture,
        custom_status
      )
      SELECT
        id,
        username,
        avatar_color,
        ${createdAtExpr},
        ${lastSeenExpr},
        ${npubExpr},
        ${lud16Expr},
        ${profilePictureExpr},
        ${customStatusExpr}
      FROM users
    `);

    db.exec('DROP TABLE users');
    db.exec('ALTER TABLE users_new RENAME TO users');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_npub ON users(npub)');
  });

  try {
    migrate();
    log.log('[DB] Users migration complete: duplicate usernames are now allowed');
    return true;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function applyLegacyGuildMasterFix({ db } = {}) {
  try {
    const rendir = db.prepare("SELECT id FROM users WHERE username = 'Rendir'").get();
    const gmRankId = 'rank-guild-byzantine-default-0';
    if (rendir) {
      db.prepare('UPDATE guild_members SET rank_id = ? WHERE guild_id = ? AND user_id = ?')
        .run(gmRankId, 'guild-byzantine-default', rendir.id);
    }
  } catch {}
}

function applyExtendedSchemaBootstrap({ db } = {}) {
  try { db.exec('ALTER TABLE messages ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE attachments ADD COLUMN uploaded_file_id TEXT REFERENCES uploaded_files(id)'); } catch {}
  try { db.exec('ALTER TABLE uploaded_files ADD COLUMN guildchat_message_id TEXT'); } catch {}
  try { db.exec('ALTER TABLE uploaded_files ADD COLUMN guildchat_guild_id TEXT'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_uploaded_files_guildchat_message ON uploaded_files(guildchat_message_id)'); } catch {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_uploaded_files_guildchat_guild ON uploaded_files(guildchat_guild_id)'); } catch {}
  try { db.exec('ALTER TABLE identity_keys ADD COLUMN bundle_signature_event TEXT'); } catch {}

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

    CREATE TABLE IF NOT EXISTS sender_key_distributions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      sender_user_id TEXT NOT NULL REFERENCES users(id),
      recipient_user_id TEXT NOT NULL REFERENCES users(id),
      distribution_id TEXT NOT NULL,
      envelope TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      delivered_at TEXT,
      UNIQUE (room_id, sender_user_id, recipient_user_id, distribution_id)
    );
    CREATE INDEX IF NOT EXISTS idx_skd_recipient_room_pending
      ON sender_key_distributions(recipient_user_id, room_id, delivered_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_skd_room_sender_distribution
      ON sender_key_distributions(room_id, sender_user_id, distribution_id);

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS signal_device_identity_keys (
      user_id TEXT NOT NULL REFERENCES users(id),
      device_id INTEGER NOT NULL,
      identity_key_public TEXT NOT NULL,
      signing_key_public TEXT NOT NULL,
      registration_id INTEGER NOT NULL,
      bundle_signature_event TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, device_id)
    );
    CREATE INDEX IF NOT EXISTS idx_signal_device_identity_user_updated
      ON signal_device_identity_keys(user_id, updated_at DESC, device_id ASC);

    CREATE TABLE IF NOT EXISTS signal_device_signed_prekeys (
      user_id TEXT NOT NULL REFERENCES users(id),
      device_id INTEGER NOT NULL,
      key_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, device_id, key_id)
    );
    CREATE INDEX IF NOT EXISTS idx_signal_device_signed_prekeys_user
      ON signal_device_signed_prekeys(user_id, device_id, key_id DESC);

    CREATE TABLE IF NOT EXISTS signal_device_one_time_prekeys (
      user_id TEXT NOT NULL REFERENCES users(id),
      device_id INTEGER NOT NULL,
      key_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, device_id, key_id)
    );
    CREATE INDEX IF NOT EXISTS idx_signal_device_otp_available
      ON signal_device_one_time_prekeys(user_id, device_id, used, key_id);

    CREATE TABLE IF NOT EXISTS signal_device_kyber_prekeys (
      user_id TEXT NOT NULL REFERENCES users(id),
      device_id INTEGER NOT NULL,
      key_id INTEGER NOT NULL,
      public_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, device_id, key_id)
    );
    CREATE INDEX IF NOT EXISTS idx_signal_device_kyber_available
      ON signal_device_kyber_prekeys(user_id, device_id, used, key_id);
  `);

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
      permission_overrides TEXT DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_guild_members_user ON guild_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_guild_ranks_guild ON guild_ranks(guild_id);
  `);
}

module.exports = {
  migrateUsersToAllowDuplicateUsernames,
  applyLegacyGuildMasterFix,
  applyExtendedSchemaBootstrap,
};
