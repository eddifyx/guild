import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendSidebarDmConversation,
  applySidebarIncomingDmMessage,
  fetchSidebarDmConversations,
  reconcileSidebarDmConversations,
  removeSidebarDmConversation,
} from '../../../client/src/features/layout/sidebarDmRuntime.mjs';

test('sidebar dm runtime fetches and normalizes direct-message conversations', async () => {
  const remembered = [];
  const conversations = await fetchSidebarDmConversations({
    apiFn: async () => [
      {
        other_user_id: 'user-2',
        other_username: 'Alice',
        other_avatar_color: '#fff',
        other_profile_picture: '/alice.png',
        other_npub: 'npub-alice',
      },
    ],
    rememberUsersFn: (entries) => remembered.push(...entries),
  });

  assert.equal(remembered.length, 1);
  assert.deepEqual(conversations, [
    {
      other_user_id: 'user-2',
      other_username: 'Alice',
      other_avatar_color: '#fff',
      other_profile_picture: '/alice.png',
      other_npub: 'npub-alice',
    },
  ]);
});

test('sidebar dm runtime reconciles conversations only when metadata changes', () => {
  const previous = [
    {
      other_user_id: 'user-2',
      other_username: 'Alice',
    },
  ];

  assert.equal(
    reconcileSidebarDmConversations({
      previousConversations: previous,
      mergeDMConversationMetaFn: (conversation) => conversation,
    }),
    previous,
  );

  const next = reconcileSidebarDmConversations({
    previousConversations: previous,
    mergeDMConversationMetaFn: (conversation) => ({
      ...conversation,
      other_username: 'Alice 2',
    }),
  });
  assert.notEqual(next, previous);
  assert.equal(next[0].other_username, 'Alice 2');
});

test('sidebar dm runtime applies incoming messages to existing and new conversations', () => {
  const remembered = [];
  const previous = [
    {
      other_user_id: 'user-2',
      other_username: 'Alice',
      other_avatar_color: '#fff',
      other_profile_picture: null,
      other_npub: null,
    },
  ];

  const updated = applySidebarIncomingDmMessage({
    previousConversations: previous,
    message: {
      sender_id: 'user-2',
      sender_name: 'Alice',
      sender_color: '#fff',
      sender_picture: '/alice.png',
      sender_npub: 'npub-alice',
    },
    currentUserId: 'user-1',
    rememberUserNpubFn: (...args) => remembered.push(args),
    mergeDMConversationMetaFn: (conversation, fallback) => ({
      ...conversation,
      other_profile_picture: fallback.profilePicture,
      other_npub: fallback.npub,
    }),
  });
  assert.equal(remembered.length, 1);
  assert.equal(updated[0].other_profile_picture, '/alice.png');

  const appended = applySidebarIncomingDmMessage({
    previousConversations: [],
    message: {
      sender_id: 'user-3',
      sender_name: 'Bob',
      sender_color: '#0f0',
      sender_picture: null,
      sender_npub: null,
    },
    currentUserId: 'user-1',
    mergeDMConversationMetaFn: (conversation) => conversation,
  });
  assert.equal(appended.length, 1);
  assert.equal(appended[0].other_user_id, 'user-3');
});

test('sidebar dm runtime appends selected users and records trust bootstrap npubs', () => {
  const remembered = [];
  const trusted = [];

  const appended = appendSidebarDmConversation({
    previousConversations: [],
    user: {
      id: 'user-2',
      username: 'Alice',
      avatar_color: '#fff',
      npub: 'npub-alice',
      trustedBootstrap: true,
    },
    rememberUserNpubFn: (...args) => remembered.push(args),
    trustUserNpubFn: (...args) => trusted.push(args),
  });

  assert.equal(appended.length, 1);
  assert.equal(remembered.length, 0);
  assert.equal(trusted.length, 1);

  const unchanged = appendSidebarDmConversation({
    previousConversations: appended,
    user: {
      id: 'user-2',
      username: 'Alice',
    },
  });
  assert.equal(unchanged, appended);
});

test('sidebar dm runtime removes conversations by partner id', () => {
  assert.deepEqual(
    removeSidebarDmConversation({
      previousConversations: [
        { other_user_id: 'user-1' },
        { other_user_id: 'user-2' },
      ],
      otherUserId: 'user-1',
    }),
    [{ other_user_id: 'user-2' }],
  );
});
