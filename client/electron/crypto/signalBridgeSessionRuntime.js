function registerSignalBridgeSessionHandlers({
  ipcMain,
  getStore,
  getSignalModule,
  normalizeDeviceId,
}) {
  ipcMain.handle('signal:process-bundle', async (_event, recipientId, recipientDeviceId = 1, bundle) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const {
      ProtocolAddress,
      PublicKey,
      KEMPublicKey,
      PreKeyBundle,
      processPreKeyBundle,
    } = await getSignalModule();
    const targetDeviceId = normalizeDeviceId(recipientDeviceId) || 1;
    const address = ProtocolAddress.new(recipientId, targetDeviceId);

    const identityKey = PublicKey.deserialize(Buffer.from(bundle.identityKey, 'base64'));
    const signedPreKey = PublicKey.deserialize(Buffer.from(bundle.signedPreKey.publicKey, 'base64'));
    const signedPreKeySig = Buffer.from(bundle.signedPreKey.signature, 'base64');

    let preKeyId = null;
    let preKeyPublic = null;
    if (bundle.oneTimePreKey) {
      preKeyId = bundle.oneTimePreKey.keyId;
      preKeyPublic = PublicKey.deserialize(Buffer.from(bundle.oneTimePreKey.publicKey, 'base64'));
    }

    if (!bundle.kyberPreKey) {
      throw new Error('Recipient has no Kyber prekeys — cannot establish PQXDH session');
    }
    const kyberPreKey = KEMPublicKey.deserialize(Buffer.from(bundle.kyberPreKey.publicKey, 'base64'));
    const kyberPreKeySig = Buffer.from(bundle.kyberPreKey.signature, 'base64');

    const preKeyBundle = PreKeyBundle.new(
      bundle.registrationId,
      targetDeviceId,
      preKeyId,
      preKeyPublic,
      bundle.signedPreKey.keyId,
      signedPreKey,
      signedPreKeySig,
      identityKey,
      bundle.kyberPreKey.keyId,
      kyberPreKey,
      kyberPreKeySig
    );

    await processPreKeyBundle(preKeyBundle, address, store.session, store.identity);
  });

  ipcMain.handle('signal:encrypt', async (_event, recipientId, recipientDeviceId = 1, plaintextStr) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, signalEncrypt } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, normalizeDeviceId(recipientDeviceId) || 1);
    const plaintext = Buffer.from(plaintextStr, 'utf8');
    const ciphertext = await signalEncrypt(plaintext, address, store.session, store.identity);

    return {
      type: ciphertext.type(),
      payload: Buffer.from(ciphertext.serialize()).toString('base64'),
    };
  });

  ipcMain.handle('signal:decrypt', async (_event, senderId, senderDeviceId = 1, type, payloadB64) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const {
      ProtocolAddress,
      CiphertextMessageType,
      PreKeySignalMessage,
      SignalMessage,
      signalDecryptPreKey,
      signalDecrypt,
    } = await getSignalModule();
    const address = ProtocolAddress.new(senderId, normalizeDeviceId(senderDeviceId) || 1);
    const payload = Buffer.from(payloadB64, 'base64');

    let plaintext;
    if (type === CiphertextMessageType.PreKey) {
      const msg = PreKeySignalMessage.deserialize(payload);
      plaintext = await signalDecryptPreKey(
        msg,
        address,
        store.session,
        store.identity,
        store.preKey,
        store.signedPreKey,
        store.kyberPreKey
      );
    } else {
      const msg = SignalMessage.deserialize(payload);
      plaintext = await signalDecrypt(msg, address, store.session, store.identity);
    }

    return Buffer.from(plaintext).toString('utf8');
  });
}

module.exports = {
  registerSignalBridgeSessionHandlers,
};
