const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVisibleUserIdSet,
  buildVisibleUsers,
  canAccessVisibleUser,
} = require('../../../server/src/domain/users/visibility');

test('buildVisibleUserIdSet includes the requester plus guildmates and contacts', () => {
  const visibleUserIds = buildVisibleUserIdSet({
    requesterUserId: 'user-self',
    guildmateRows: [{ user_id: 'user-a' }, { user_id: 'user-b' }],
    contactRows: [{ user_id: 'user-b' }, { user_id: 'user-c' }],
  });

  assert.deepEqual(Array.from(visibleUserIds).sort(), [
    'user-a',
    'user-b',
    'user-c',
    'user-self',
  ]);
});

test('buildVisibleUsers filters system users and sorts by username', () => {
  const users = buildVisibleUsers([
    { id: 'user-2', username: 'Zephyr' },
    { id: 'system-1', username: 'System' },
    { id: 'user-1', username: 'Alpha' },
    null,
  ]);

  assert.deepEqual(users, [
    { id: 'user-1', username: 'Alpha' },
    { id: 'user-2', username: 'Zephyr' },
  ]);
});

test('canAccessVisibleUser keeps self-access and visible-user access stable', () => {
  const visibleUserIds = new Set(['user-a']);

  assert.equal(canAccessVisibleUser({
    requesterUserId: 'user-self',
    targetUserId: 'user-self',
    visibleUserIds,
  }), true);

  assert.equal(canAccessVisibleUser({
    requesterUserId: 'user-self',
    targetUserId: 'user-a',
    visibleUserIds,
  }), true);

  assert.equal(canAccessVisibleUser({
    requesterUserId: 'user-self',
    targetUserId: 'user-b',
    visibleUserIds,
  }), false);
});
