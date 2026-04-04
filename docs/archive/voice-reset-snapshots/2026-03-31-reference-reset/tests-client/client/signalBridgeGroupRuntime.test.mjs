import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  registerSignalBridgeGroupHandlers,
} = require('../../../client/electron/crypto/signalBridgeGroupRuntime.js');

function createIpcMain() {
  const handlers = new Map();
  return {
    handlers,
    handle(channel, callback) {
      handlers.set(channel, callback);
    },
  };
}

function createSignalModuleStub(overrides = {}) {
  return {
    ProtocolAddress: {
      new(name, deviceId) {
        return { name, deviceId };
      },
    },
    SenderKeyDistributionMessage: {
      async create(senderAddress, distributionId, senderKeyStore) {
        if (overrides.createSkdm) {
          return overrides.createSkdm(senderAddress, distributionId, senderKeyStore);
        }
        return {
          serialize() {
            return Buffer.from(`skdm:${senderAddress.name}:${distributionId}`, 'utf8');
          },
        };
      },
      deserialize(buffer) {
        if (overrides.deserializeSkdm) {
          return overrides.deserializeSkdm(buffer);
        }
        return { encoded: buffer.toString('utf8') };
      },
    },
    async processSenderKeyDistributionMessage(senderAddress, skdm, senderKeyStore) {
      if (overrides.processSkdm) {
        return overrides.processSkdm(senderAddress, skdm, senderKeyStore);
      }
      return undefined;
    },
    async groupEncrypt(senderAddress, distributionId, senderKeyStore, plaintext) {
      if (overrides.groupEncrypt) {
        return overrides.groupEncrypt(senderAddress, distributionId, senderKeyStore, plaintext);
      }
      return {
        serialize() {
          return Buffer.from(`group:${senderAddress.name}:${distributionId}:${plaintext.toString('utf8')}`, 'utf8');
        },
      };
    },
    async groupDecrypt(senderAddress, senderKeyStore, payload) {
      if (overrides.groupDecrypt) {
        return overrides.groupDecrypt(senderAddress, senderKeyStore, payload);
      }
      return Buffer.from(`plain:${senderAddress.name}:${payload.toString('utf8')}`, 'utf8');
    },
  };
}

test('signal bridge group runtime creates, processes, and rekeys sender-key messages canonically', async () => {
  const ipcMain = createIpcMain();
  const deletedRoomKeys = [];
  const processed = [];
  const roomDistribution = {
    getOrCreate(roomId) {
      return `dist:${roomId}`;
    },
    get(roomId) {
      return roomId === 'room-a' ? 'old:room-a' : null;
    },
    reset(roomId) {
      return `new:${roomId}`;
    },
  };
  const senderKey = {
    deleteSenderKeysForRoom(distributionId) {
      deletedRoomKeys.push(distributionId);
    },
  };

  registerSignalBridgeGroupHandlers({
    ipcMain,
    getStore: () => ({
      roomDistribution,
      senderKey,
    }),
    getUserId: () => 'local-user',
    getSignalModule: async () => createSignalModuleStub({
      processSkdm(senderAddress, skdm, senderKeyStore) {
        processed.push({ senderAddress, skdm, senderKeyStore });
      },
    }),
  });

  assert.deepEqual(await ipcMain.handlers.get('signal:create-skdm')(null, 'room-a'), {
    skdm: Buffer.from('skdm:local-user:dist:room-a', 'utf8').toString('base64'),
    distributionId: 'dist:room-a',
  });

  await ipcMain.handlers.get('signal:process-skdm')(
    null,
    'remote-user',
    Buffer.from('incoming-skdm', 'utf8').toString('base64')
  );
  assert.deepEqual(processed, [
    {
      senderAddress: { name: 'remote-user', deviceId: 1 },
      skdm: { encoded: 'incoming-skdm' },
      senderKeyStore: senderKey,
    },
  ]);

  assert.deepEqual(await ipcMain.handlers.get('signal:rekey-room')(null, 'room-a'), {
    skdm: Buffer.from('skdm:local-user:new:room-a', 'utf8').toString('base64'),
    distributionId: 'new:room-a',
  });
  assert.deepEqual(deletedRoomKeys, ['old:room-a']);
});

test('signal bridge group runtime encrypts and decrypts group payloads through canonical handlers', async () => {
  const ipcMain = createIpcMain();

  registerSignalBridgeGroupHandlers({
    ipcMain,
    getStore: () => ({
      roomDistribution: {
        getOrCreate(roomId) {
          return `dist:${roomId}`;
        },
        get() {
          return null;
        },
        reset(roomId) {
          return `new:${roomId}`;
        },
      },
      senderKey: { label: 'sender-key-store' },
    }),
    getUserId: () => 'local-user',
    getSignalModule: async () => createSignalModuleStub({
      async groupDecrypt(senderAddress, senderKeyStore, payload) {
        if (payload.toString('utf8') === 'bad-payload') {
          const error = new Error('decrypt failed');
          error.code = 'BAD_PAYLOAD';
          error.operation = 'group-decrypt';
          throw error;
        }
        return Buffer.from(`decrypted:${senderAddress.name}:${payload.toString('utf8')}`, 'utf8');
      },
    }),
  });

  assert.equal(
    await ipcMain.handlers.get('signal:group-encrypt')(null, 'room-a', 'hello'),
    Buffer.from('group:local-user:dist:room-a:hello', 'utf8').toString('base64')
  );
  assert.deepEqual(
    await ipcMain.handlers.get('signal:group-decrypt')(
      null,
      'remote-user',
      'room-a',
      Buffer.from('ciphertext', 'utf8').toString('base64')
    ),
    {
      ok: true,
      plaintext: 'decrypted:remote-user:ciphertext',
    }
  );
  assert.deepEqual(
    await ipcMain.handlers.get('signal:group-decrypt')(
      null,
      'remote-user',
      'room-a',
      Buffer.from('bad-payload', 'utf8').toString('base64')
    ),
    {
      ok: false,
      error: {
        message: 'decrypt failed',
        code: 'BAD_PAYLOAD',
        operation: 'group-decrypt',
      },
    }
  );
});

test('signal bridge group runtime rejects operations when the store is unavailable', async () => {
  const ipcMain = createIpcMain();

  registerSignalBridgeGroupHandlers({
    ipcMain,
    getStore: () => null,
    getUserId: () => 'local-user',
    getSignalModule: async () => createSignalModuleStub(),
  });

  await assert.rejects(() => ipcMain.handlers.get('signal:create-skdm')(null, 'room-a'), /Signal store not initialized/);
  await assert.rejects(
    () => ipcMain.handlers.get('signal:process-skdm')(null, 'remote-user', Buffer.from('x').toString('base64')),
    /Signal store not initialized/
  );
  await assert.rejects(() => ipcMain.handlers.get('signal:group-encrypt')(null, 'room-a', 'hello'), /Signal store not initialized/);
  await assert.rejects(
    () => ipcMain.handlers.get('signal:group-decrypt')(null, 'remote-user', 'room-a', Buffer.from('x').toString('base64')),
    /Signal store not initialized/
  );
  await assert.rejects(() => ipcMain.handlers.get('signal:rekey-room')(null, 'room-a'), /Signal store not initialized/);
});
