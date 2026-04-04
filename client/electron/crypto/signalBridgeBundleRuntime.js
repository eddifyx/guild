const MAX_BUNDLE_OTP_EXPORT = 200;

function registerSignalBridgeBundleHandlers({
  ipcMain,
  getStore,
  getUserId,
  getOrCreateLocalDeviceId,
  generatePreKeys,
  generateKyberPreKey,
  otpBatchSize,
  kyberBatchSize,
}) {
  ipcMain.handle('signal:get-bundle', async () => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');
    const currentDeviceId = getOrCreateLocalDeviceId(getUserId());

    const identity = store.identity.getLocalIdentityKeyPair();
    const regId = await store.identity.getLocalRegistrationId();
    const spkId = store.signedPreKey.getMaxKeyId();
    const spk = await store.signedPreKey.getSignedPreKey(spkId);

    const kyberPreKeys = [];
    for (const id of store.kyberPreKey.getAllIds()) {
      const kpk = await store.kyberPreKey.getKyberPreKey(id);
      kyberPreKeys.push({
        keyId: kpk.id(),
        publicKey: Buffer.from(kpk.publicKey().serialize()).toString('base64'),
        signature: Buffer.from(kpk.signature()).toString('base64'),
      });
    }
    const kyberPreKey = kyberPreKeys.length > 0 ? kyberPreKeys[kyberPreKeys.length - 1] : null;

    const oneTimePreKeys = [];
    const exportPreKeyIds = [...store.preKey.getAllIds()]
      .sort((left, right) => Number(left) - Number(right))
      .slice(-MAX_BUNDLE_OTP_EXPORT);
    for (const id of exportPreKeyIds) {
      const pk = await store.preKey.getPreKey(id);
      oneTimePreKeys.push({
        keyId: pk.id(),
        publicKey: Buffer.from(pk.publicKey().serialize()).toString('base64'),
      });
    }

    return {
      deviceId: currentDeviceId,
      identityKey: Buffer.from(identity.publicKey.serialize()).toString('base64'),
      registrationId: regId,
      signedPreKey: {
        keyId: spk.id(),
        publicKey: Buffer.from(spk.publicKey().serialize()).toString('base64'),
        signature: Buffer.from(spk.signature()).toString('base64'),
      },
      kyberPreKey,
      kyberPreKeys,
      oneTimePreKeys,
    };
  });

  ipcMain.handle('signal:replenish-otps', async (_event, count) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const startId = store.preKey.getMaxKeyId() + 1;
    const batchSize = count || otpBatchSize;
    const records = await generatePreKeys(startId, batchSize);

    const result = [];
    for (const pk of records) {
      await store.preKey.savePreKey(pk.id(), pk);
      result.push({
        keyId: pk.id(),
        publicKey: Buffer.from(pk.publicKey().serialize()).toString('base64'),
      });
    }
    return result;
  });

  ipcMain.handle('signal:replenish-kyber', async (_event, count) => {
    const store = getStore();
    if (!store) throw new Error('Signal store not initialized');

    const identity = store.identity.getLocalIdentityKeyPair();
    const startId = store.kyberPreKey.getMaxKeyId() + 1;
    const batchSize = count || kyberBatchSize;

    const result = [];
    for (let i = 0; i < batchSize; i += 1) {
      const id = startId + i;
      const record = await generateKyberPreKey(identity, id);
      await store.kyberPreKey.saveKyberPreKey(id, record);
      result.push({
        keyId: id,
        publicKey: Buffer.from(record.publicKey().serialize()).toString('base64'),
        signature: Buffer.from(record.signature()).toString('base64'),
      });
    }
    return result;
  });

  ipcMain.handle('signal:otp-count', async () => {
    const store = getStore();
    if (!store) return 0;
    return store.preKey.getCount();
  });

  ipcMain.handle('signal:kyber-count', async () => {
    const store = getStore();
    if (!store) return 0;
    return store.kyberPreKey.getCount();
  });
}

module.exports = {
  MAX_BUNDLE_OTP_EXPORT,
  registerSignalBridgeBundleHandlers,
};
