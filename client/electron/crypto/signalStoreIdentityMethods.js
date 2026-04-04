const { deserializeLocalIdentityKeyPair } = require('./signalStoreSessionIdentityStorage');
const {
  buildApprovedIdentityState,
  buildIdentityTrustState,
  buildSavedIdentityState,
  isTrustedIdentityRecord,
} = require('./signalStoreIdentityState');

function resolveSignalAddress(address) {
  return address.toString();
}

function getStoredLocalIdentityKeyPair({ loadLocalIdentity, masterKey, IdentityKeyPair }) {
  const localIdentity = loadLocalIdentity();
  if (!localIdentity) return null;
  return deserializeLocalIdentityKeyPair(
    masterKey,
    localIdentity.serializedKeyPair,
    IdentityKeyPair
  );
}

function getStoredIdentityPrivateKey({ loadLocalIdentity, masterKey, IdentityKeyPair }) {
  const keyPair = getStoredLocalIdentityKeyPair({
    loadLocalIdentity,
    masterKey,
    IdentityKeyPair,
  });
  if (!keyPair) throw new Error('No local identity key');
  return keyPair.privateKey;
}

function getStoredLocalRegistrationId({ loadLocalIdentity }) {
  const localIdentity = loadLocalIdentity();
  if (!localIdentity) throw new Error('No local identity');
  return localIdentity.registrationId;
}

async function approveStoredIdentity({
  address,
  key,
  options = {},
  readIdentityRecord,
  writeIdentityRecord,
}) {
  const addr = resolveSignalAddress(address);
  const existing = readIdentityRecord(addr);
  const keyBytes = Buffer.from(key.serialize());
  const nextState = buildApprovedIdentityState(existing, keyBytes, options);

  writeIdentityRecord(addr, keyBytes, nextState.record);

  return { changed: nextState.changed, verified: nextState.verified };
}

async function getStoredTrustState({ address, key = null, readIdentityRecord }) {
  const addr = resolveSignalAddress(address);
  const existing = readIdentityRecord(addr);
  const candidateBytes = key ? Buffer.from(key.serialize()) : null;
  return buildIdentityTrustState(existing, candidateBytes);
}

async function saveStoredIdentity({
  address,
  key,
  readIdentityRecord,
  writeIdentityRecord,
  IdentityChange,
}) {
  const addr = resolveSignalAddress(address);
  const existing = readIdentityRecord(addr);
  const keyBytes = Buffer.from(key.serialize());
  const nextState = buildSavedIdentityState(existing, keyBytes, IdentityChange);

  writeIdentityRecord(addr, keyBytes, nextState.record);
  return nextState.change;
}

async function isStoredIdentityTrusted({ address, key, readIdentityRecord }) {
  const addr = resolveSignalAddress(address);
  const existing = readIdentityRecord(addr);
  const newKey = Buffer.from(key.serialize());
  return isTrustedIdentityRecord(existing, newKey);
}

async function getStoredIdentity({ address, readIdentityRecord, PublicKey }) {
  const addr = resolveSignalAddress(address);
  const existing = readIdentityRecord(addr);
  if (!existing) return null;
  return PublicKey.deserialize(existing.keyBytes);
}

module.exports = {
  approveStoredIdentity,
  getStoredIdentity,
  getStoredIdentityPrivateKey,
  getStoredLocalIdentityKeyPair,
  getStoredLocalRegistrationId,
  getStoredTrustState,
  isStoredIdentityTrusted,
  saveStoredIdentity,
};
