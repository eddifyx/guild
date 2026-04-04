function registerSignalBridgeGroupHandlers({
  ipcMain,
  getStore,
  getUserId,
  getSignalModule,
}) {
  ipcMain.handle('signal:create-skdm', async (_event, roomId) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, SenderKeyDistributionMessage } = await getSignalModule();
    const distributionId = store.roomDistribution.getOrCreate(roomId);
    const senderAddress = ProtocolAddress.new(getUserId(), 1);

    const skdm = await SenderKeyDistributionMessage.create(
      senderAddress,
      distributionId,
      store.senderKey
    );

    return {
      skdm: Buffer.from(skdm.serialize()).toString('base64'),
      distributionId,
    };
  });

  ipcMain.handle('signal:process-skdm', async (_event, senderId, skdmB64) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const {
      ProtocolAddress,
      SenderKeyDistributionMessage,
      processSenderKeyDistributionMessage,
    } = await getSignalModule();
    const senderAddress = ProtocolAddress.new(senderId, 1);
    const skdm = SenderKeyDistributionMessage.deserialize(Buffer.from(skdmB64, 'base64'));

    await processSenderKeyDistributionMessage(senderAddress, skdm, store.senderKey);
  });

  ipcMain.handle('signal:group-encrypt', async (_event, roomId, plaintextStr) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, groupEncrypt } = await getSignalModule();
    const distributionId = store.roomDistribution.getOrCreate(roomId);
    const senderAddress = ProtocolAddress.new(getUserId(), 1);
    const plaintext = Buffer.from(plaintextStr, 'utf8');

    const ciphertext = await groupEncrypt(
      senderAddress,
      distributionId,
      store.senderKey,
      plaintext
    );

    return Buffer.from(ciphertext.serialize()).toString('base64');
  });

  ipcMain.handle('signal:group-decrypt', async (_event, senderId, roomId, payloadB64) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    try {
      const { ProtocolAddress, groupDecrypt } = await getSignalModule();
      const senderAddress = ProtocolAddress.new(senderId, 1);
      const payload = Buffer.from(payloadB64, 'base64');

      const plaintext = await groupDecrypt(senderAddress, store.senderKey, payload);
      return {
        ok: true,
        plaintext: Buffer.from(plaintext).toString('utf8'),
      };
    } catch (err) {
      return {
        ok: false,
        error: {
          message: err?.message || String(err || 'Group decrypt failed'),
          code: err?.code ?? null,
          operation: err?.operation ?? null,
        },
      };
    }
  });

  ipcMain.handle('signal:rekey-room', async (_event, roomId) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const oldDistId = store.roomDistribution.get(roomId);
    if (oldDistId) {
      store.senderKey.deleteSenderKeysForRoom(oldDistId);
    }
    const newDistId = store.roomDistribution.reset(roomId);

    const { ProtocolAddress, SenderKeyDistributionMessage } = await getSignalModule();
    const senderAddress = ProtocolAddress.new(getUserId(), 1);
    const skdm = await SenderKeyDistributionMessage.create(
      senderAddress,
      newDistId,
      store.senderKey
    );

    return {
      skdm: Buffer.from(skdm.serialize()).toString('base64'),
      distributionId: newDistId,
    };
  });
}

module.exports = {
  registerSignalBridgeGroupHandlers,
};
