import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  getExistingStoredSessions,
  getStoredSession,
  removeStoredSession,
  saveStoredSession,
} = require('../../../client/electron/crypto/signalStoreSessionMethods.js');

class FakeRecord {
  constructor(payload) {
    this.payload = Buffer.from(payload);
  }

  serialize() {
    return this.payload;
  }

  static deserialize(data) {
    return new FakeRecord(data);
  }
}

test('signal store session methods save and load stored sessions through the shared codec path', async () => {
  const masterKey = crypto.randomBytes(32);
  const stored = new Map();

  await saveStoredSession({
    address: { toString: () => 'user.7:2' },
    record: new FakeRecord('session-payload'),
    masterKey,
    writeStoredSession: (addr, value) => stored.set(addr, value),
  });

  const session = await getStoredSession({
    address: { toString: () => 'user.7:2' },
    masterKey,
    readStoredSession: (addr) => stored.get(addr) ?? null,
    SessionRecord: FakeRecord,
  });

  assert.deepEqual(session.payload, Buffer.from('session-payload'));
});

test('signal store session methods collect existing sessions and remove stored sessions canonically', async () => {
  const seen = [];
  const deleted = [];

  const sessions = await getExistingStoredSessions({
    addresses: [{ toString: () => 'a' }, { toString: () => 'b' }, { toString: () => 'c' }],
    getSession: async (address) => {
      const value = address.toString();
      seen.push(value);
      return value === 'b' ? null : `${value}:session`;
    },
  });

  await removeStoredSession({
    address: { toString: () => 'gone' },
    deleteStoredSession: (addr) => deleted.push(addr),
  });

  assert.deepEqual(seen, ['a', 'b', 'c']);
  assert.deepEqual(sessions, ['a:session', 'c:session']);
  assert.deepEqual(deleted, ['gone']);
});
