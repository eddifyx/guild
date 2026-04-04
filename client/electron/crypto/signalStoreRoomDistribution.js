const crypto = require('crypto');

class SQLiteRoomDistributionMap {
  constructor(db, cryptoRef = crypto) {
    this._crypto = cryptoRef;
    this._save = db.prepare('INSERT OR REPLACE INTO room_distribution (room_id, distribution_id) VALUES (?, ?)');
    this._get = db.prepare('SELECT distribution_id FROM room_distribution WHERE room_id = ?');
    this._del = db.prepare('DELETE FROM room_distribution WHERE room_id = ?');
  }

  getOrCreate(roomId) {
    const row = this._get.get(roomId);
    if (row) return row.distribution_id;
    const id = this._crypto.randomUUID();
    this._save.run(roomId, id);
    return id;
  }

  get(roomId) {
    const row = this._get.get(roomId);
    return row?.distribution_id ?? null;
  }

  reset(roomId) {
    this._del.run(roomId);
    const id = this._crypto.randomUUID();
    this._save.run(roomId, id);
    return id;
  }
}

class MemoryRoomDistributionMap {
  constructor(cryptoRef = crypto) {
    this._crypto = cryptoRef;
    this._roomDistribution = new Map();
  }

  getOrCreate(roomId) {
    const existing = this._roomDistribution.get(roomId);
    if (existing) return existing;
    const id = this._crypto.randomUUID();
    this._roomDistribution.set(roomId, id);
    return id;
  }

  get(roomId) {
    return this._roomDistribution.get(roomId) ?? null;
  }

  reset(roomId) {
    const id = this._crypto.randomUUID();
    this._roomDistribution.set(roomId, id);
    return id;
  }
}

function createSQLiteRoomDistributionMap({ db, cryptoRef = crypto }) {
  return new SQLiteRoomDistributionMap(db, cryptoRef);
}

function createMemoryRoomDistributionMap({ cryptoRef = crypto } = {}) {
  return new MemoryRoomDistributionMap(cryptoRef);
}

module.exports = {
  createMemoryRoomDistributionMap,
  createSQLiteRoomDistributionMap,
};
