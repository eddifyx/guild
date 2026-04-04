import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeSidebarDmConversationFlow,
  selectSidebarDmUser,
} from '../../../client/src/features/layout/sidebarActionsRuntime.mjs';

test('sidebar actions runtime appends and selects DM users through the shared flow', () => {
  const calls = [];

  selectSidebarDmUser({
    user: { id: 'user-2', username: 'Nova', npub: 'npub1' },
    setDMConversationsFn: (updater) => {
      calls.push(['set', updater([{ other_user_id: 'user-1' }])]);
    },
    appendSidebarDmConversationFn: ({ previousConversations, user }) => (
      [...previousConversations, { other_user_id: user.id }]
    ),
    onSelectDMFn: (value) => {
      calls.push(['select', value]);
    },
  });

  assert.deepEqual(calls, [
    ['set', [{ other_user_id: 'user-1' }, { other_user_id: 'user-2' }]],
    ['select', { other_user_id: 'user-2', other_username: 'Nova', other_npub: 'npub1' }],
  ]);
});

test('sidebar actions runtime removes DM conversations and clears active DM selection', () => {
  const calls = [];
  const socket = {
    emit: (...args) => calls.push(['emit', ...args]),
  };

  const removed = removeSidebarDmConversationFlow({
    socket,
    otherUserId: 'user-2',
    setDMConversationsFn: (updater) => {
      calls.push(['set', updater([{ other_user_id: 'user-2' }, { other_user_id: 'user-3' }])]);
    },
    removeSidebarDmConversationFn: ({ previousConversations, otherUserId }) => (
      previousConversations.filter((entry) => entry.other_user_id !== otherUserId)
    ),
    conversation: { type: 'dm', id: 'user-2' },
    onSelectRoomFn: (value) => calls.push(['select-room', value]),
  });

  assert.equal(removed, true);
  assert.deepEqual(calls, [
    ['emit', 'dm:conversation:delete', { otherUserId: 'user-2' }],
    ['set', [{ other_user_id: 'user-3' }]],
    ['select-room', null],
  ]);
});
