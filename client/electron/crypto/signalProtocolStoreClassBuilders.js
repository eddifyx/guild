const {
  getExistingStoredSessions,
  getStoredSession,
  removeStoredSession,
  saveStoredSession,
} = require('./signalStoreSessionMethods');
const {
  approveStoredIdentity,
  getStoredIdentity,
  getStoredIdentityPrivateKey,
  getStoredLocalIdentityKeyPair,
  getStoredLocalRegistrationId,
  getStoredTrustState,
  isStoredIdentityTrusted,
  saveStoredIdentity,
} = require('./signalStoreIdentityMethods');

function createSessionStoreClass({
  SessionStoreBase,
  SessionRecord,
  initialize,
  getMasterKey,
  readStoredSession,
  writeStoredSession,
  deleteStoredSession,
}) {
  return class extends SessionStoreBase {
    constructor(...args) {
      super();
      initialize(this, ...args);
    }

    async saveSession(address, record) {
      return saveStoredSession({
        address,
        record,
        masterKey: getMasterKey(this),
        writeStoredSession: (addr, storedRecord) => writeStoredSession(this, addr, storedRecord),
      });
    }

    async getSession(address) {
      return getStoredSession({
        address,
        masterKey: getMasterKey(this),
        readStoredSession: (addr) => readStoredSession(this, addr),
        SessionRecord,
      });
    }

    async getExistingSessions(addresses) {
      return getExistingStoredSessions({
        addresses,
        getSession: this.getSession.bind(this),
      });
    }

    async removeSession(address) {
      return removeStoredSession({
        address,
        deleteStoredSession: (addr) => deleteStoredSession(this, addr),
      });
    }
  };
}

function createIdentityKeyStoreClass({
  IdentityKeyStoreBase,
  PublicKey,
  IdentityKeyPair,
  IdentityChange,
  initialize,
  getMasterKey,
  loadLocalIdentity,
  saveLocalIdentityRecord,
  readIdentityRecord,
  writeIdentityRecord,
}) {
  return class extends IdentityKeyStoreBase {
    constructor(...args) {
      super();
      initialize(this, ...args);
    }

    saveLocalIdentity(keyPair, registrationId) {
      saveLocalIdentityRecord(this, keyPair, registrationId);
    }

    hasLocalIdentity() {
      return !!loadLocalIdentity(this);
    }

    _loadLocalIdentity() {
      return loadLocalIdentity(this);
    }

    _readIdentityRecord(address) {
      return readIdentityRecord(this, address);
    }

    _writeIdentityRecord(address, keyBytes, options) {
      return writeIdentityRecord(this, address, keyBytes, options);
    }

    async getIdentityKey() {
      return getStoredIdentityPrivateKey({
        loadLocalIdentity: () => this._loadLocalIdentity(),
        masterKey: getMasterKey(this),
        IdentityKeyPair,
      });
    }

    async getLocalRegistrationId() {
      return getStoredLocalRegistrationId({
        loadLocalIdentity: () => this._loadLocalIdentity(),
      });
    }

    async approveIdentity(address, key, options = {}) {
      return approveStoredIdentity({
        address,
        key,
        options,
        readIdentityRecord: (addr) => this._readIdentityRecord(addr),
        writeIdentityRecord: (addr, keyBytes, record) => this._writeIdentityRecord(addr, keyBytes, record),
      });
    }

    async markIdentityVerified(address, key) {
      return this.approveIdentity(address, key, { verified: true });
    }

    async getTrustState(address, key = null) {
      return getStoredTrustState({
        address,
        key,
        readIdentityRecord: (addr) => this._readIdentityRecord(addr),
      });
    }

    async saveIdentity(address, key) {
      return saveStoredIdentity({
        address,
        key,
        readIdentityRecord: (addr) => this._readIdentityRecord(addr),
        writeIdentityRecord: (addr, keyBytes, record) => this._writeIdentityRecord(addr, keyBytes, record),
        IdentityChange,
      });
    }

    async isTrustedIdentity(address, key) {
      return isStoredIdentityTrusted({
        address,
        key,
        readIdentityRecord: (addr) => this._readIdentityRecord(addr),
      });
    }

    async getIdentity(address) {
      return getStoredIdentity({
        address,
        readIdentityRecord: (addr) => this._readIdentityRecord(addr),
        PublicKey,
      });
    }

    getLocalIdentityKeyPair() {
      return getStoredLocalIdentityKeyPair({
        loadLocalIdentity: () => this._loadLocalIdentity(),
        masterKey: getMasterKey(this),
        IdentityKeyPair,
      });
    }
  };
}

module.exports = {
  createIdentityKeyStoreClass,
  createSessionStoreClass,
};
