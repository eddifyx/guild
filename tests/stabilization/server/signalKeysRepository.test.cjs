const test = require('node:test');
const assert = require('node:assert/strict');

const { createSignalKeysRepository } = require('../../../server/src/repositories/signalKeysRepository');

function createFakeDb({
  gets = new Map(),
  alls = new Map(),
  runs = [],
} = {}) {
  return {
    prepare(sql) {
      return {
        get(...args) {
          const handler = gets.get(sql);
          return typeof handler === 'function' ? handler(...args) : (handler ?? null);
        },
        all(...args) {
          const handler = alls.get(sql);
          return typeof handler === 'function' ? handler(...args) : (handler ?? []);
        },
        run(...args) {
          runs.push({ sql, args });
          return { changes: 1 };
        },
      };
    },
    transaction(fn) {
      return (...args) => fn(...args);
    },
  };
}

test('signal keys repository claims the next available one-time prekey and marks it used', () => {
  const runs = [];
  const db = createFakeDb({
    gets: new Map([
      [
        'SELECT * FROM one_time_prekeys WHERE user_id = ? AND used = 0 ORDER BY key_id LIMIT 1',
        () => ({ key_id: 7, public_key: 'otp-7' }),
      ],
    ]),
    runs,
  });

  const repository = createSignalKeysRepository({ db });
  assert.deepEqual(repository.getAndClaimOneTimePreKey('user-1'), { key_id: 7, public_key: 'otp-7' });
  assert.deepEqual(runs, [
    {
      sql: 'UPDATE one_time_prekeys SET used = 1 WHERE user_id = ? AND key_id = ?',
      args: ['user-1', 7],
    },
  ]);
});

test('signal keys repository leaves one-time prekey state unchanged when none are available', () => {
  const runs = [];
  const db = createFakeDb({
    gets: new Map([
      [
        'SELECT * FROM one_time_prekeys WHERE user_id = ? AND used = 0 ORDER BY key_id LIMIT 1',
        null,
      ],
    ]),
    runs,
  });

  const repository = createSignalKeysRepository({ db });
  assert.equal(repository.getAndClaimOneTimePreKey('user-1'), null);
  assert.deepEqual(runs, []);
});

test('signal keys repository acknowledges sender-key distributions cumulatively', () => {
  const runs = [];
  const db = createFakeDb({ runs });
  const repository = createSignalKeysRepository({ db });

  assert.equal(
    repository.acknowledgeSenderKeyDistributions('user-1', 'room-1', ['dist-1', 'dist-2']),
    2
  );
  assert.deepEqual(runs, [
    {
      sql: `UPDATE sender_key_distributions
     SET delivered_at = COALESCE(delivered_at, datetime('now'))
     WHERE id = ? AND recipient_user_id = ? AND room_id = ?`,
      args: ['dist-1', 'user-1', 'room-1'],
    },
    {
      sql: `UPDATE sender_key_distributions
     SET delivered_at = COALESCE(delivered_at, datetime('now'))
     WHERE id = ? AND recipient_user_id = ? AND room_id = ?`,
      args: ['dist-2', 'user-1', 'room-1'],
    },
  ]);
});

test('signal keys repository reset clears all persisted key tables for the user', () => {
  const runs = [];
  const db = createFakeDb({ runs });
  const repository = createSignalKeysRepository({ db });

  repository.resetUserKeys('user-9');

  assert.deepEqual(
    runs.map(({ sql, args }) => ({ sql, args })),
    [
      { sql: 'DELETE FROM identity_keys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM signed_prekeys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM one_time_prekeys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM kyber_prekeys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM signal_device_identity_keys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM signal_device_signed_prekeys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM signal_device_one_time_prekeys WHERE user_id = ?', args: ['user-9'] },
      { sql: 'DELETE FROM signal_device_kyber_prekeys WHERE user_id = ?', args: ['user-9'] },
    ]
  );
});
