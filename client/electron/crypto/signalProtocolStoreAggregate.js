function createProtocolStoreMembers({
  createSessionStore,
  createIdentityStore,
  createPreKeyStore,
  createSignedPreKeyStore,
  createKyberPreKeyStore,
  createSenderKeyStore,
  createRoomDistribution,
}) {
  return {
    session: createSessionStore(),
    identity: createIdentityStore(),
    preKey: createPreKeyStore(),
    signedPreKey: createSignedPreKeyStore(),
    kyberPreKey: createKyberPreKeyStore(),
    senderKey: createSenderKeyStore(),
    roomDistribution: createRoomDistribution(),
  };
}

function createProtocolStoreClass({
  initializeStoreState = () => ({}),
  createMemberFactories,
  closeDatabase,
}) {
  return class ProtocolStore {
    constructor(userId, masterKey) {
      const state = initializeStoreState({ userId, masterKey });
      Object.assign(this, state);
      Object.assign(
        this,
        createProtocolStoreMembers(
          createMemberFactories({ store: this, state, userId, masterKey })
        )
      );
    }

    async removeSession(address) {
      await removeProtocolStoreSession(this, address);
    }

    close() {
      closeProtocolStoreState(this, { closeDatabase });
    }
  };
}

async function removeProtocolStoreSession(store, address) {
  await store.session.removeSession(address);
}

function closeProtocolStoreState(store, { closeDatabase } = {}) {
  if (store._db && closeDatabase) {
    closeDatabase(store._db);
    store._db = null;
  }

  if (store._mk) {
    store._mk.fill(0);
    store._mk = null;
  }
}

module.exports = {
  closeProtocolStoreState,
  createProtocolStoreClass,
  createProtocolStoreMembers,
  removeProtocolStoreSession,
};
