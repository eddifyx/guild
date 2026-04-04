function registerSignalBridgeIdentityHandlers({
  ipcMain,
  getStore,
  getUserId,
  getSignalModule,
  normalizeDeviceId,
}) {
  ipcMain.handle(
    'signal:get-identity-state',
    async (_event, recipientId, recipientDeviceId = 1, identityKeyB64 = null) => {
      const store = getStore();
      if (!store) throw new Error('Signal store not initialized');

      const { ProtocolAddress, PublicKey } = await getSignalModule();
      const address = ProtocolAddress.new(recipientId, normalizeDeviceId(recipientDeviceId) || 1);
      const identityKey = identityKeyB64
        ? PublicKey.deserialize(Buffer.from(identityKeyB64, 'base64'))
        : null;
      return store.identity.getTrustState(address, identityKey);
    }
  );

  ipcMain.handle(
    'signal:approve-identity',
    async (_event, recipientId, recipientDeviceId = 1, identityKeyB64, options = {}) => {
      const store = getStore();
      if (!store) throw new Error('Signal store not initialized');

      const { ProtocolAddress, PublicKey } = await getSignalModule();
      const address = ProtocolAddress.new(recipientId, normalizeDeviceId(recipientDeviceId) || 1);
      const identityKey = PublicKey.deserialize(Buffer.from(identityKeyB64, 'base64'));
      return store.identity.approveIdentity(address, identityKey, options);
    }
  );

  ipcMain.handle(
    'signal:mark-identity-verified',
    async (_event, recipientId, recipientDeviceId = 1, identityKeyB64) => {
      const store = getStore();
      if (!store) throw new Error('Signal store not initialized');

      const { ProtocolAddress, PublicKey } = await getSignalModule();
      const address = ProtocolAddress.new(recipientId, normalizeDeviceId(recipientDeviceId) || 1);
      const identityKey = PublicKey.deserialize(Buffer.from(identityKeyB64, 'base64'));
      return store.identity.markIdentityVerified(address, identityKey);
    }
  );

  ipcMain.handle('signal:has-session', async (_event, recipientId, recipientDeviceId = 1) => {
    const store = getStore();
    if (!store) return false;

    const { ProtocolAddress } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, normalizeDeviceId(recipientDeviceId) || 1);
    const session = await store.session.getSession(address);
    return session !== null && session.hasCurrentState();
  });

  ipcMain.handle('signal:delete-session', async (_event, recipientId, recipientDeviceId = 1) => {
    const store = getStore();
    if (!store) return;

    const { ProtocolAddress } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, normalizeDeviceId(recipientDeviceId) || 1);
    await store.removeSession(address);
  });

  ipcMain.handle('signal:get-fingerprint', async (_event, theirUserId, theirIdentityKeyB64) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const { PublicKey, Fingerprint } = await getSignalModule();
    const localIdentity = store.identity.getLocalIdentityKeyPair();
    const theirKey = PublicKey.deserialize(Buffer.from(theirIdentityKeyB64, 'base64'));

    const fingerprint = Fingerprint.new(
      5200,
      2,
      Buffer.from(getUserId()),
      localIdentity.publicKey,
      Buffer.from(theirUserId),
      theirKey
    );

    return fingerprint.displayableFingerprint().toString();
  });
}

module.exports = {
  registerSignalBridgeIdentityHandlers,
};
