const crypto = require('crypto');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const { initTables: initializeSchemaTables } = require('./startup/schemaBootstrap');

const COLORS = [
  '#e94560', '#0f3460', '#533483', '#e94560', '#00b4d8',
  '#06d6a0', '#ffd166', '#ef476f', '#118ab2', '#073b4c',
  '#8338ec', '#ff006e',
];

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'messenger.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initTables() {
  initializeSchemaTables({ db });
}

function hashColor(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  db,
  initTables,
  hashColor,
  hashToken,
};
