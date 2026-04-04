const SIGNAL_STORE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS local_identity (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    key_pair BLOB NOT NULL,
    registration_id INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS identity_keys (
    address TEXT PRIMARY KEY,
    public_key BLOB NOT NULL,
    trusted INTEGER NOT NULL DEFAULT 1,
    verified INTEGER NOT NULL DEFAULT 0,
    first_seen INTEGER,
    last_seen INTEGER
  );

  CREATE TABLE IF NOT EXISTS pre_keys (
    id INTEGER PRIMARY KEY,
    record BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS signed_pre_keys (
    id INTEGER PRIMARY KEY,
    record BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kyber_pre_keys (
    id INTEGER PRIMARY KEY,
    record BLOB NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    address TEXT PRIMARY KEY,
    record BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sender_keys (
    address TEXT NOT NULL,
    distribution_id TEXT NOT NULL,
    record BLOB NOT NULL,
    PRIMARY KEY (address, distribution_id)
  );

  CREATE TABLE IF NOT EXISTS room_distribution (
    room_id TEXT PRIMARY KEY,
    distribution_id TEXT NOT NULL
  );
`;

function ensureSignalStoreColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => row.name);
  if (!columns.includes(columnName)) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

function migrateSignalStoreDatabase(db) {
  ensureSignalStoreColumn(db, 'identity_keys', 'verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureSignalStoreColumn(db, 'identity_keys', 'first_seen', 'INTEGER');
  ensureSignalStoreColumn(db, 'identity_keys', 'last_seen', 'INTEGER');
}

module.exports = {
  SIGNAL_STORE_SCHEMA,
  ensureSignalStoreColumn,
  migrateSignalStoreDatabase,
};
