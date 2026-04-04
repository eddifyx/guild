function createPreKeyStoreClass({
  PreKeyStoreBase,
  PreKeyRecord,
  initialize,
  getMasterKey,
  serializeRecord,
  deserializeRecord,
  saveStoredRecord,
  readStoredRecord,
  deleteStoredRecord,
  getMaxKeyId,
  getCount,
  getAllIds,
}) {
  return class extends PreKeyStoreBase {
    constructor(...args) {
      super();
      initialize(this, ...args);
    }

    async savePreKey(id, record) {
      const blob = serializeRecord(getMasterKey(this), id, record);
      saveStoredRecord(this, id, blob);
    }

    async getPreKey(id) {
      const record = readStoredRecord(this, id);
      if (!record) throw new Error(`PreKey ${id} not found`);
      return deserializeRecord(getMasterKey(this), record, id, PreKeyRecord);
    }

    async removePreKey(id) {
      deleteStoredRecord(this, id);
    }

    getMaxKeyId() {
      return getMaxKeyId(this);
    }

    getCount() {
      return getCount(this);
    }

    getAllIds() {
      return getAllIds(this);
    }
  };
}

function createSignedPreKeyStoreClass({
  SignedPreKeyStoreBase,
  SignedPreKeyRecord,
  initialize,
  getMasterKey,
  serializeRecord,
  deserializeRecord,
  saveStoredRecord,
  readStoredRecord,
  getMaxKeyId,
}) {
  return class extends SignedPreKeyStoreBase {
    constructor(...args) {
      super();
      initialize(this, ...args);
    }

    async saveSignedPreKey(id, record) {
      const blob = serializeRecord(getMasterKey(this), id, record);
      saveStoredRecord(this, id, blob);
    }

    async getSignedPreKey(id) {
      const record = readStoredRecord(this, id);
      if (!record) throw new Error(`SignedPreKey ${id} not found`);
      return deserializeRecord(getMasterKey(this), record, id, SignedPreKeyRecord);
    }

    getMaxKeyId() {
      return getMaxKeyId(this);
    }
  };
}

function createKyberPreKeyStoreClass({
  KyberPreKeyStoreBase,
  KyberPreKeyRecord,
  initialize,
  getMasterKey,
  serializeRecord,
  deserializeRecord,
  saveStoredRecord,
  readStoredRecord,
  markStoredRecordUsed,
  getMaxKeyId,
  getCount,
  getAllIds,
}) {
  return class extends KyberPreKeyStoreBase {
    constructor(...args) {
      super();
      initialize(this, ...args);
    }

    async saveKyberPreKey(id, record) {
      const blob = serializeRecord(getMasterKey(this), id, record);
      saveStoredRecord(this, id, blob);
    }

    async getKyberPreKey(id) {
      const record = readStoredRecord(this, id);
      if (!record) throw new Error(`KyberPreKey ${id} not found`);
      return deserializeRecord(getMasterKey(this), record, id, KyberPreKeyRecord);
    }

    async markKyberPreKeyUsed(id) {
      markStoredRecordUsed(this, id);
    }

    getMaxKeyId() {
      return getMaxKeyId(this);
    }

    getCount() {
      return getCount(this);
    }

    getAllIds() {
      return getAllIds(this);
    }
  };
}

function createSenderKeyStoreClass({
  SenderKeyStoreBase,
  SenderKeyRecord,
  initialize,
  getMasterKey,
  serializeRecord,
  deserializeRecord,
  normalizeAddress = (address) => address.toString(),
  saveStoredRecord,
  readStoredRecord,
  deleteRoomRecords,
}) {
  return class extends SenderKeyStoreBase {
    constructor(...args) {
      super();
      initialize(this, ...args);
    }

    async saveSenderKey(address, distributionId, record) {
      const addr = normalizeAddress(address);
      const blob = serializeRecord(getMasterKey(this), addr, distributionId, record);
      saveStoredRecord(this, addr, distributionId, blob);
    }

    async getSenderKey(address, distributionId) {
      const addr = normalizeAddress(address);
      const record = readStoredRecord(this, addr, distributionId);
      if (!record) return null;
      return deserializeRecord(getMasterKey(this), record, addr, distributionId, SenderKeyRecord);
    }

    deleteSenderKeysForRoom(distributionId) {
      deleteRoomRecords(this, distributionId);
    }
  };
}

module.exports = {
  createKyberPreKeyStoreClass,
  createPreKeyStoreClass,
  createSenderKeyStoreClass,
  createSignedPreKeyStoreClass,
};
