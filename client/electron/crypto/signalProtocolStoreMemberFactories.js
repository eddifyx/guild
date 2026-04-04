function createSQLiteProtocolStoreMemberFactories({
  db,
  masterKey,
  SessionStoreClass,
  IdentityStoreClass,
  PreKeyStoreClass,
  SignedPreKeyStoreClass,
  KyberPreKeyStoreClass,
  SenderKeyStoreClass,
  createRoomDistributionMap,
}) {
  return {
    createSessionStore: () => new SessionStoreClass(db, masterKey),
    createIdentityStore: () => new IdentityStoreClass(db, masterKey),
    createPreKeyStore: () => new PreKeyStoreClass(db, masterKey),
    createSignedPreKeyStore: () => new SignedPreKeyStoreClass(db, masterKey),
    createKyberPreKeyStore: () => new KyberPreKeyStoreClass(db, masterKey),
    createSenderKeyStore: () => new SenderKeyStoreClass(db, masterKey),
    createRoomDistribution: () => createRoomDistributionMap({ db }),
  };
}

function createMemoryProtocolStoreMemberFactories({
  masterKey,
  SessionStoreClass,
  IdentityStoreClass,
  PreKeyStoreClass,
  SignedPreKeyStoreClass,
  KyberPreKeyStoreClass,
  SenderKeyStoreClass,
  createRoomDistributionMap,
}) {
  return {
    createSessionStore: () => new SessionStoreClass(masterKey),
    createIdentityStore: () => new IdentityStoreClass(masterKey),
    createPreKeyStore: () => new PreKeyStoreClass(masterKey),
    createSignedPreKeyStore: () => new SignedPreKeyStoreClass(masterKey),
    createKyberPreKeyStore: () => new KyberPreKeyStoreClass(masterKey),
    createSenderKeyStore: () => new SenderKeyStoreClass(masterKey),
    createRoomDistribution: () => createRoomDistributionMap(),
  };
}

module.exports = {
  createMemoryProtocolStoreMemberFactories,
  createSQLiteProtocolStoreMemberFactories,
};
