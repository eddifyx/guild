import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  closeProtocolStoreState,
  createProtocolStoreClass,
  createProtocolStoreMembers,
  removeProtocolStoreSession,
} = require('../../../client/electron/crypto/signalProtocolStoreAggregate.js');

test('signal protocol store aggregate creates the canonical store member shape once', () => {
  const calls = [];

  const members = createProtocolStoreMembers({
    createSessionStore: () => (calls.push('session'), { name: 'session-store' }),
    createIdentityStore: () => (calls.push('identity'), { name: 'identity-store' }),
    createPreKeyStore: () => (calls.push('preKey'), { name: 'prekey-store' }),
    createSignedPreKeyStore: () => (calls.push('signedPreKey'), { name: 'signed-prekey-store' }),
    createKyberPreKeyStore: () => (calls.push('kyberPreKey'), { name: 'kyber-prekey-store' }),
    createSenderKeyStore: () => (calls.push('senderKey'), { name: 'sender-key-store' }),
    createRoomDistribution: () => (calls.push('roomDistribution'), { name: 'room-distribution' }),
  });

  assert.deepEqual(calls, [
    'session',
    'identity',
    'preKey',
    'signedPreKey',
    'kyberPreKey',
    'senderKey',
    'roomDistribution',
  ]);
  assert.deepEqual(Object.keys(members), [
    'session',
    'identity',
    'preKey',
    'signedPreKey',
    'kyberPreKey',
    'senderKey',
    'roomDistribution',
  ]);
});

test('signal protocol store aggregate delegates removeSession through the session owner', async () => {
  const seen = [];
  const store = {
    session: {
      async removeSession(address) {
        seen.push(address);
      },
    },
  };

  await removeProtocolStoreSession(store, 'user.7:1');
  assert.deepEqual(seen, ['user.7:1']);
});

test('signal protocol store aggregate creates protocol store classes with canonical state, members, and shutdown', async () => {
  const seen = [];
  const ProtocolStore = createProtocolStoreClass({
    initializeStoreState: ({ userId, masterKey }) => ({
      _db: { userId, closed: false },
      _mk: Buffer.from(masterKey),
      lane: userId,
    }),
    createMemberFactories: ({ store, userId, masterKey }) => ({
      createSessionStore: () => ({
        kind: 'session',
        userId,
        keyHex: Buffer.from(masterKey).toString('hex'),
        async removeSession(address) {
          seen.push(['session.remove', address, store.lane]);
        },
      }),
      createIdentityStore: () => ({ kind: 'identity' }),
      createPreKeyStore: () => ({ kind: 'preKey' }),
      createSignedPreKeyStore: () => ({ kind: 'signedPreKey' }),
      createKyberPreKeyStore: () => ({ kind: 'kyberPreKey' }),
      createSenderKeyStore: () => ({ kind: 'senderKey' }),
      createRoomDistribution: () => ({ kind: 'roomDistribution' }),
    }),
    closeDatabase(db) {
      db.closed = true;
      seen.push(['db.close', db.userId]);
    },
  });

  const store = new ProtocolStore('user.9', Buffer.from([9, 9]));
  assert.equal(store.lane, 'user.9');
  assert.equal(store.session.kind, 'session');
  assert.equal(store.session.userId, 'user.9');

  await store.removeSession('user.9:1');
  assert.deepEqual(seen, [['session.remove', 'user.9:1', 'user.9']]);

  store.close();
  assert.equal(store._db, null);
  assert.equal(store._mk, null);
  assert.deepEqual(seen, [
    ['session.remove', 'user.9:1', 'user.9'],
    ['db.close', 'user.9'],
  ]);
});

test('signal protocol store aggregate closes database handles and zeroes the master key', () => {
  const store = {
    _db: { closeCalled: false, close() { this.closeCalled = true; } },
    _mk: Buffer.from([1, 2, 3, 4]),
  };

  closeProtocolStoreState(store, { closeDatabase: (db) => db.close() });

  assert.equal(store._db, null);
  assert.equal(store._mk, null);
});
