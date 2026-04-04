const {
  collectExistingSessions,
  deserializeSessionRecord,
  serializeSessionRecord,
} = require('./signalStoreSessionIdentityStorage');

function normalizeSessionAddress(address) {
  return address.toString();
}

async function saveStoredSession({ address, record, masterKey, writeStoredSession }) {
  const addr = normalizeSessionAddress(address);
  writeStoredSession(addr, serializeSessionRecord(masterKey, addr, record));
}

async function getStoredSession({ address, masterKey, readStoredSession, SessionRecord }) {
  const addr = normalizeSessionAddress(address);
  const storedRecord = readStoredSession(addr);
  if (!storedRecord) return null;
  return deserializeSessionRecord(masterKey, storedRecord, addr, SessionRecord);
}

async function getExistingStoredSessions({ addresses, getSession }) {
  return collectExistingSessions(addresses, getSession);
}

async function removeStoredSession({ address, deleteStoredSession }) {
  deleteStoredSession(normalizeSessionAddress(address));
}

module.exports = {
  getExistingStoredSessions,
  getStoredSession,
  removeStoredSession,
  saveStoredSession,
};
