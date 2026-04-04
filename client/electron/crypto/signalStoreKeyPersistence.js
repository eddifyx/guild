const { decryptAtRest, encryptAtRest } = require('./signalStoreCrypto');

function serializeStoredRecord(masterKey, record, aad) {
  return encryptAtRest(masterKey, Buffer.from(record.serialize()), aad);
}

function deserializeStoredRecord(masterKey, storedRecord, aad, RecordType) {
  const data = decryptAtRest(masterKey, storedRecord, aad);
  return RecordType.deserialize(data);
}

function buildPreKeyAad(id) {
  return `prekey:${id}`;
}

function serializePreKeyRecord(masterKey, id, record) {
  return serializeStoredRecord(masterKey, record, buildPreKeyAad(id));
}

function deserializePreKeyRecord(masterKey, storedRecord, id, RecordType) {
  return deserializeStoredRecord(masterKey, storedRecord, buildPreKeyAad(id), RecordType);
}

function buildSignedPreKeyAad(id) {
  return `spk:${id}`;
}

function serializeSignedPreKeyRecord(masterKey, id, record) {
  return serializeStoredRecord(masterKey, record, buildSignedPreKeyAad(id));
}

function deserializeSignedPreKeyRecord(masterKey, storedRecord, id, RecordType) {
  return deserializeStoredRecord(masterKey, storedRecord, buildSignedPreKeyAad(id), RecordType);
}

function buildKyberPreKeyAad(id) {
  return `kyber:${id}`;
}

function serializeKyberPreKeyRecord(masterKey, id, record) {
  return serializeStoredRecord(masterKey, record, buildKyberPreKeyAad(id));
}

function deserializeKyberPreKeyRecord(masterKey, storedRecord, id, RecordType) {
  return deserializeStoredRecord(masterKey, storedRecord, buildKyberPreKeyAad(id), RecordType);
}

function getMapMaxKeyId(records) {
  return records.size ? Math.max(...records.keys()) : 0;
}

function getSortedMapKeyIds(records) {
  return [...records.keys()].sort((a, b) => a - b);
}

function countUnusedMapEntries(records) {
  return [...records.values()].filter((entry) => !entry.used).length;
}

function getSortedUnusedMapKeyIds(records) {
  return [...records.entries()]
    .filter(([, entry]) => !entry.used)
    .map(([id]) => id)
    .sort((a, b) => a - b);
}

function normalizeSenderAddress(address) {
  return typeof address === 'string' ? address : address.toString();
}

function buildSenderKeyAad(address, distributionId) {
  return `sk:${normalizeSenderAddress(address)}:${distributionId}`;
}

function serializeSenderKeyRecord(masterKey, address, distributionId, record) {
  return serializeStoredRecord(masterKey, record, buildSenderKeyAad(address, distributionId));
}

function deserializeSenderKeyRecord(masterKey, storedRecord, address, distributionId, RecordType) {
  return deserializeStoredRecord(
    masterKey,
    storedRecord,
    buildSenderKeyAad(address, distributionId),
    RecordType
  );
}

function buildSenderKeyStorageKey(address, distributionId) {
  return `${normalizeSenderAddress(address)}::${distributionId}`;
}

function isSenderKeyStorageKeyForDistribution(key, distributionId) {
  return key.endsWith(`::${distributionId}`);
}

module.exports = {
  buildKyberPreKeyAad,
  buildPreKeyAad,
  buildSenderKeyAad,
  buildSignedPreKeyAad,
  buildSenderKeyStorageKey,
  countUnusedMapEntries,
  deserializeSenderKeyRecord,
  deserializeKyberPreKeyRecord,
  deserializePreKeyRecord,
  deserializeSignedPreKeyRecord,
  deserializeStoredRecord,
  getMapMaxKeyId,
  getSortedMapKeyIds,
  getSortedUnusedMapKeyIds,
  isSenderKeyStorageKeyForDistribution,
  serializeSenderKeyRecord,
  serializeKyberPreKeyRecord,
  serializePreKeyRecord,
  serializeSignedPreKeyRecord,
  serializeStoredRecord,
};
