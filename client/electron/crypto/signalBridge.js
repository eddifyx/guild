/**
 * /guild — libsignal IPC Bridge
 *
 * Registers ipcMain handlers for all crypto operations. The renderer
 * calls these via window.signalCrypto (exposed in preload.js).
 *
 * All key material stays in the main process. The renderer only ever
 * sees plaintext and opaque ciphertext blobs.
 */

const { app, safeStorage } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { createProtocolStore } = require('./signalStore');
const { importLibsignalModule } = require('./runtimeModules');
let signalModulePromise = null;

async function getSignalModule() {
  if (!signalModulePromise) {
    signalModulePromise = importLibsignalModule();
  }

  return signalModulePromise;
}

const DEVICE_ID = 1; // Single-device for now
const OTP_BATCH_SIZE = 100;
const KYBER_BATCH_SIZE = 20;

let store = null;
let userId = null;

// ---------------------------------------------------------------------------
// Master key management (Electron safeStorage → OS keychain)
// Persisted to a file in userData so it survives app restarts.
// ---------------------------------------------------------------------------

function _masterKeyPath(uid) {
  return path.join(app.getPath('userData'), `signal-mk-${uid}.enc`);
}

function getMasterKey(uid) {
  const mkPath = _masterKeyPath(uid);

  if (fs.existsSync(mkPath)) {
    const encrypted = fs.readFileSync(mkPath);
    return safeStorage.decryptString(encrypted);
  }

  // Generate new master key and persist the safeStorage-encrypted blob to disk
  const mk = crypto.randomBytes(32);
  const mkB64 = mk.toString('base64');
  const encrypted = safeStorage.encryptString(mkB64);
  fs.writeFileSync(mkPath, encrypted);

  return mkB64;
}

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

async function generatePreKeys(startId, count) {
  const { PrivateKey, PreKeyRecord } = await getSignalModule();
  const records = [];
  for (let i = 0; i < count; i++) {
    const id = startId + i;
    const privateKey = PrivateKey.generate();
    const publicKey = privateKey.getPublicKey();
    const record = PreKeyRecord.new(id, publicKey, privateKey);
    records.push(record);
  }
  return records;
}

async function generateSignedPreKey(identityKeyPair, id) {
  const { PrivateKey, SignedPreKeyRecord } = await getSignalModule();
  const timestamp = Date.now();
  const privateKey = PrivateKey.generate();
  const publicKey = privateKey.getPublicKey();
  const signature = identityKeyPair.privateKey.sign(
    Buffer.from(publicKey.serialize())
  );
  return SignedPreKeyRecord.new(id, timestamp, publicKey, privateKey, signature);
}

async function generateKyberPreKey(identityKeyPair, id) {
  const { KEMKeyPair, KyberPreKeyRecord } = await getSignalModule();
  const timestamp = Date.now();
  const keyPair = KEMKeyPair.generate();
  const signature = identityKeyPair.privateKey.sign(
    Buffer.from(keyPair.getPublicKey().serialize())
  );
  return KyberPreKeyRecord.new(id, timestamp, keyPair, signature);
}

// ---------------------------------------------------------------------------
// IPC Handler Registration
// ---------------------------------------------------------------------------

function registerSignalHandlers(ipcMain) {

  // ---- Initialize ----
  ipcMain.handle('signal:initialize', async (_event, uid) => {
    userId = uid;

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS keychain (safeStorage) not available');
    }

    const { IdentityKeyPair } = await getSignalModule();
    const mkBase64 = getMasterKey(uid);
    const masterKey = Buffer.from(mkBase64, 'base64');
    store = await createProtocolStore(uid, masterKey);

    let isNew = false;
    if (!store.identity.hasLocalIdentity()) {
      isNew = true;
      // Generate identity key pair and registration ID
      const identityKeyPair = IdentityKeyPair.generate();
      const registrationId = (crypto.randomInt(16383) + 1); // 1-16383

      store.identity.saveLocalIdentity(identityKeyPair, registrationId);

      // Generate initial prekeys
      const preKeys = await generatePreKeys(1, OTP_BATCH_SIZE);
      for (const pk of preKeys) {
        await store.preKey.savePreKey(pk.id(), pk);
      }

      // Generate initial signed prekey
      const spk = await generateSignedPreKey(identityKeyPair, 1);
      await store.signedPreKey.saveSignedPreKey(spk.id(), spk);

      // Generate initial Kyber prekeys
      for (let i = 0; i < KYBER_BATCH_SIZE; i++) {
        const kpk = await generateKyberPreKey(identityKeyPair, i + 1);
        await store.kyberPreKey.saveKyberPreKey(kpk.id(), kpk);
      }
    }

    const localIdentity = store.identity.getLocalIdentityKeyPair();
    return {
      isNew,
      identityKeyPublic: Buffer.from(localIdentity.publicKey.serialize()).toString('base64'),
    };
  });

  // ---- Destroy (logout) ----
  ipcMain.handle('signal:destroy', async () => {
    if (store) {
      store.close();
      store = null;
    }
    userId = null;
  });

  // ---- Get prekey bundle for server upload ----
  ipcMain.handle('signal:get-bundle', async () => {
    if (!store) throw new Error('Signal store not initialized');

    const identity = store.identity.getLocalIdentityKeyPair();
    const regId = await store.identity.getLocalRegistrationId();

    // Get latest signed prekey
    const spkId = store.signedPreKey.getMaxKeyId();
    const spk = await store.signedPreKey.getSignedPreKey(spkId);

    // Collect all remaining Kyber prekeys (public parts)
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

    // Collect all remaining one-time prekeys (public parts)
    const oneTimePreKeys = [];
    for (const id of store.preKey.getAllIds()) {
      const pk = await store.preKey.getPreKey(id);
      oneTimePreKeys.push({
        keyId: pk.id(),
        publicKey: Buffer.from(pk.publicKey().serialize()).toString('base64'),
      });
    }

    return {
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

  // ---- Inspect remote identity trust state ----
  ipcMain.handle('signal:get-identity-state', async (_event, recipientId, identityKeyB64 = null) => {
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, PublicKey } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);
    const identityKey = identityKeyB64
      ? PublicKey.deserialize(Buffer.from(identityKeyB64, 'base64'))
      : null;
    return store.identity.getTrustState(address, identityKey);
  });

  // ---- Explicitly approve a remote identity key ----
  ipcMain.handle('signal:approve-identity', async (_event, recipientId, identityKeyB64, options = {}) => {
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, PublicKey } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);
    const identityKey = PublicKey.deserialize(Buffer.from(identityKeyB64, 'base64'));
    return store.identity.approveIdentity(address, identityKey, options);
  });

  // ---- Manually verify / re-trust a remote identity key ----
  ipcMain.handle('signal:mark-identity-verified', async (_event, recipientId, identityKeyB64) => {
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, PublicKey } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);
    const identityKey = PublicKey.deserialize(Buffer.from(identityKeyB64, 'base64'));
    return store.identity.markIdentityVerified(address, identityKey);
  });

  // ---- Process recipient's prekey bundle (establish session) ----
  ipcMain.handle('signal:process-bundle', async (_event, recipientId, bundle) => {
    if (!store) throw new Error('Signal store not initialized');

    const {
      ProtocolAddress,
      PublicKey,
      KEMPublicKey,
      PreKeyBundle,
      processPreKeyBundle,
    } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);

    const identityKey = PublicKey.deserialize(Buffer.from(bundle.identityKey, 'base64'));
    const signedPreKey = PublicKey.deserialize(Buffer.from(bundle.signedPreKey.publicKey, 'base64'));
    const signedPreKeySig = Buffer.from(bundle.signedPreKey.signature, 'base64');

    // One-time prekey (optional)
    let preKeyId = null;
    let preKeyPublic = null;
    if (bundle.oneTimePreKey) {
      preKeyId = bundle.oneTimePreKey.keyId;
      preKeyPublic = PublicKey.deserialize(Buffer.from(bundle.oneTimePreKey.publicKey, 'base64'));
    }

    // Kyber prekey (required by libsignal PQXDH — fail early if missing)
    if (!bundle.kyberPreKey) {
      throw new Error('Recipient has no Kyber prekeys — cannot establish PQXDH session');
    }
    const kyberPreKey = KEMPublicKey.deserialize(Buffer.from(bundle.kyberPreKey.publicKey, 'base64'));
    const kyberPreKeySig = Buffer.from(bundle.kyberPreKey.signature, 'base64');

    const preKeyBundle = PreKeyBundle.new(
      bundle.registrationId,
      DEVICE_ID,
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

  // ---- Encrypt DM ----
  ipcMain.handle('signal:encrypt', async (_event, recipientId, plaintextStr) => {
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, signalEncrypt } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);
    const plaintext = Buffer.from(plaintextStr, 'utf8');
    const ciphertext = await signalEncrypt(plaintext, address, store.session, store.identity);

    return {
      type: ciphertext.type(),
      payload: Buffer.from(ciphertext.serialize()).toString('base64'),
    };
  });

  // ---- Decrypt DM ----
  ipcMain.handle('signal:decrypt', async (_event, senderId, type, payloadB64) => {
    if (!store) throw new Error('Signal store not initialized');

    const {
      ProtocolAddress,
      CiphertextMessageType,
      PreKeySignalMessage,
      SignalMessage,
      signalDecryptPreKey,
      signalDecrypt,
    } = await getSignalModule();
    const address = ProtocolAddress.new(senderId, DEVICE_ID);
    const payload = Buffer.from(payloadB64, 'base64');

    let plaintext;
    if (type === CiphertextMessageType.PreKey) {
      const msg = PreKeySignalMessage.deserialize(payload);
      plaintext = await signalDecryptPreKey(
        msg, address, store.session, store.identity,
        store.preKey, store.signedPreKey, store.kyberPreKey
      );
    } else {
      const msg = SignalMessage.deserialize(payload);
      plaintext = await signalDecrypt(msg, address, store.session, store.identity);
    }

    return Buffer.from(plaintext).toString('utf8');
  });

  // ---- Check session existence ----
  ipcMain.handle('signal:has-session', async (_event, recipientId) => {
    if (!store) return false;
    const { ProtocolAddress } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);
    const session = await store.session.getSession(address);
    return session !== null && session.hasCurrentState();
  });

  // ---- Delete session (for re-keying) ----
  ipcMain.handle('signal:delete-session', async (_event, recipientId) => {
    if (!store) return;
    const { ProtocolAddress } = await getSignalModule();
    const address = ProtocolAddress.new(recipientId, DEVICE_ID);
    await store.removeSession(address);
  });

  // ---- Create SenderKeyDistributionMessage ----
  ipcMain.handle('signal:create-skdm', async (_event, roomId) => {
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, SenderKeyDistributionMessage } = await getSignalModule();
    const distributionId = store.roomDistribution.getOrCreate(roomId);
    const senderAddress = ProtocolAddress.new(userId, DEVICE_ID);

    const skdm = await SenderKeyDistributionMessage.create(
      senderAddress, distributionId, store.senderKey
    );

    return {
      skdm: Buffer.from(skdm.serialize()).toString('base64'),
      distributionId,
    };
  });

  // ---- Process received SKDM ----
  ipcMain.handle('signal:process-skdm', async (_event, senderId, skdmB64) => {
    if (!store) throw new Error('Signal store not initialized');

    const {
      ProtocolAddress,
      SenderKeyDistributionMessage,
      processSenderKeyDistributionMessage,
    } = await getSignalModule();
    const senderAddress = ProtocolAddress.new(senderId, DEVICE_ID);
    const skdm = SenderKeyDistributionMessage.deserialize(Buffer.from(skdmB64, 'base64'));

    await processSenderKeyDistributionMessage(senderAddress, skdm, store.senderKey);
  });

  // ---- Group encrypt ----
  ipcMain.handle('signal:group-encrypt', async (_event, roomId, plaintextStr) => {
    if (!store) throw new Error('Signal store not initialized');

    const { ProtocolAddress, groupEncrypt } = await getSignalModule();
    const distributionId = store.roomDistribution.getOrCreate(roomId);
    const senderAddress = ProtocolAddress.new(userId, DEVICE_ID);
    const plaintext = Buffer.from(plaintextStr, 'utf8');

    const ciphertext = await groupEncrypt(
      senderAddress, distributionId, store.senderKey, plaintext
    );

    return Buffer.from(ciphertext.serialize()).toString('base64');
  });

  // ---- Group decrypt ----
  ipcMain.handle('signal:group-decrypt', async (_event, senderId, roomId, payloadB64) => {
    if (!store) throw new Error('Signal store not initialized');

    try {
      const { ProtocolAddress, groupDecrypt } = await getSignalModule();
      const senderAddress = ProtocolAddress.new(senderId, DEVICE_ID);
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

  // ---- Re-key room (forward secrecy on member leave) ----
  ipcMain.handle('signal:rekey-room', async (_event, roomId) => {
    if (!store) throw new Error('Signal store not initialized');

    // Delete old sender keys for this room and generate new distribution
    const oldDistId = store.roomDistribution.get(roomId);
    if (oldDistId) {
      store.senderKey.deleteSenderKeysForRoom(oldDistId);
    }
    const newDistId = store.roomDistribution.reset(roomId);

    const { ProtocolAddress, SenderKeyDistributionMessage } = await getSignalModule();
    const senderAddress = ProtocolAddress.new(userId, DEVICE_ID);
    const skdm = await SenderKeyDistributionMessage.create(
      senderAddress, newDistId, store.senderKey
    );

    return {
      skdm: Buffer.from(skdm.serialize()).toString('base64'),
      distributionId: newDistId,
    };
  });

  // ---- Safety number / fingerprint ----
  ipcMain.handle('signal:get-fingerprint', async (_event, theirUserId, theirIdentityKeyB64) => {
    if (!store) throw new Error('Signal store not initialized');

    const { PublicKey, Fingerprint } = await getSignalModule();
    const localIdentity = store.identity.getLocalIdentityKeyPair();
    const theirKey = PublicKey.deserialize(Buffer.from(theirIdentityKeyB64, 'base64'));

    const fingerprint = Fingerprint.new(
      5200,  // iterations (matches Signal)
      2,     // version
      Buffer.from(userId),
      localIdentity.publicKey,
      Buffer.from(theirUserId),
      theirKey
    );

    return fingerprint.displayableFingerprint().toString();
  });

  // ---- Replenish one-time prekeys ----
  ipcMain.handle('signal:replenish-otps', async (_event, count) => {
    if (!store) throw new Error('Signal store not initialized');

    const startId = store.preKey.getMaxKeyId() + 1;
    const batchSize = count || OTP_BATCH_SIZE;
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

  // ---- Replenish Kyber prekeys ----
  ipcMain.handle('signal:replenish-kyber', async (_event, count) => {
    if (!store) throw new Error('Signal store not initialized');

    const identity = store.identity.getLocalIdentityKeyPair();
    const startId = store.kyberPreKey.getMaxKeyId() + 1;
    const batchSize = count || KYBER_BATCH_SIZE;

    const result = [];
    for (let i = 0; i < batchSize; i++) {
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

  // ---- Get OTP count (for replenishment checks) ----
  ipcMain.handle('signal:otp-count', async () => {
    if (!store) return 0;
    return store.preKey.getCount();
  });

  // ---- Get Kyber prekey count ----
  ipcMain.handle('signal:kyber-count', async () => {
    if (!store) return 0;
    return store.kyberPreKey.getCount();
  });
}

module.exports = { registerSignalHandlers };
