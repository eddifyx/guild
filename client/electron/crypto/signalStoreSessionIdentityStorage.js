const { decryptAtRest, encryptAtRest } = require('./signalStoreCrypto');
const {
  deserializeStoredRecord,
  serializeStoredRecord,
} = require('./signalStoreKeyPersistence');

function normalizeSignalAddress(address) {
  return typeof address === 'string' ? address : address.toString();
}

function buildSessionAad(address) {
  return `session:${normalizeSignalAddress(address)}`;
}

function serializeSessionRecord(masterKey, address, record) {
  return serializeStoredRecord(masterKey, record, buildSessionAad(address));
}

function deserializeSessionRecord(masterKey, storedRecord, address, SessionRecord) {
  return deserializeStoredRecord(masterKey, storedRecord, buildSessionAad(address), SessionRecord);
}

async function collectExistingSessions(addresses, getSession) {
  const results = [];
  for (const address of addresses) {
    const session = await getSession(address);
    if (session) results.push(session);
  }
  return results;
}

function serializeLocalIdentityKeyPair(masterKey, keyPair) {
  return encryptAtRest(masterKey, Buffer.from(keyPair.serialize()), 'local_identity');
}

function deserializeLocalIdentityKeyPair(masterKey, storedKeyPair, IdentityKeyPair) {
  const data = decryptAtRest(masterKey, storedKeyPair, 'local_identity');
  return IdentityKeyPair.deserialize(data);
}

function buildIdentityRecordAad(address) {
  return `identity:${normalizeSignalAddress(address)}`;
}

function encryptIdentityKeyBytes(masterKey, keyBytes, address) {
  return encryptAtRest(masterKey, keyBytes, buildIdentityRecordAad(address));
}

function decryptIdentityKeyBytes(masterKey, storedKeyBytes, address) {
  return decryptAtRest(masterKey, storedKeyBytes, buildIdentityRecordAad(address));
}

module.exports = {
  buildIdentityRecordAad,
  buildSessionAad,
  collectExistingSessions,
  decryptIdentityKeyBytes,
  deserializeLocalIdentityKeyPair,
  deserializeSessionRecord,
  encryptIdentityKeyBytes,
  normalizeSignalAddress,
  serializeLocalIdentityKeyPair,
  serializeSessionRecord,
};
