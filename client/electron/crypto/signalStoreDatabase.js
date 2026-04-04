const path = require('path');
const { app } = require('electron');
const { requireRuntimeModule } = require('./runtimeModules');
const {
  SIGNAL_STORE_SCHEMA,
  ensureSignalStoreColumn,
  migrateSignalStoreDatabase,
} = require('./signalStoreDatabaseSchema');

function buildSignalStoreDatabasePath(userId, userDataPath = app.getPath('userData')) {
  return path.join(userDataPath, `signal-protocol-${userId}.db`);
}

function openSignalStoreDatabase(
  userId,
  {
    Database = requireRuntimeModule('better-sqlite3'),
    dbPath = buildSignalStoreDatabasePath(userId),
    schema = SIGNAL_STORE_SCHEMA,
  } = {}
) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  migrateSignalStoreDatabase(db);
  return db;
}

module.exports = {
  SIGNAL_STORE_SCHEMA,
  buildSignalStoreDatabasePath,
  ensureSignalStoreColumn,
  migrateSignalStoreDatabase,
  openSignalStoreDatabase,
};
