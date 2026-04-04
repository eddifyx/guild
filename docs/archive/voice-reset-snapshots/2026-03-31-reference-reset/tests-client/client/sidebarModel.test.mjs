import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSidebarGuildHeaderState,
  buildSidebarIncomingDmConversation,
  canSidebarManageRooms,
  mergeSidebarDmConversationMeta,
  resolveSidebarDmUserMeta,
} from '../../../client/src/features/layout/sidebarModel.mjs';

test('sidebar model derives guild header state for tavern focus and unread mentions', () => {
  const activeState = buildSidebarGuildHeaderState({
    currentGuildData: { name: 'Byzantine Generals', image_url: 'guild.png' },
    sidebarGuildImgFailed: false,
    guildChatMentionUnread: false,
    conversation: null,
    getFileUrlFn: (value) => `https://cdn.example/${value}`,
  });
  const unreadState = buildSidebarGuildHeaderState({
    currentGuildData: { name: 'Byzantine Generals', image_url: 'guild.png' },
    sidebarGuildImgFailed: true,
    guildChatMentionUnread: true,
    conversation: { type: 'room', id: 'general' },
    getFileUrlFn: (value) => `https://cdn.example/${value}`,
  });

  assert.equal(activeState.isTavernActive, true);
  assert.equal(activeState.guildImageUrl, 'https://cdn.example/guild.png');
  assert.equal(activeState.guildNameColor, '#40FF40');
  assert.equal(unreadState.guildImageUrl, null);
  assert.equal(unreadState.guildNameColor, '#ffb35c');
});

test('sidebar model resolves and merges dm user metadata from guild and online maps', () => {
  const guildMembersById = new Map([
    ['user-1', { username: 'Guildmate', avatarColor: '#123456', profilePicture: 'guild.png', npub: 'npub-guild' }],
  ]);
  const onlineUsersById = new Map([
    ['user-2', { username: 'OnlineUser', avatarColor: '#abcdef', profilePicture: 'online.png', npub: 'npub-online' }],
  ]);

  const resolvedGuildMeta = resolveSidebarDmUserMeta({
    guildMembersById,
    onlineUsersById,
    otherUserId: 'user-1',
    fallback: { username: 'Fallback' },
  });
  const resolvedOnlineMeta = resolveSidebarDmUserMeta({
    guildMembersById,
    onlineUsersById,
    otherUserId: 'user-2',
    fallback: { username: 'Fallback' },
  });

  assert.deepEqual(resolvedGuildMeta, {
    username: 'Guildmate',
    avatarColor: '#123456',
    profilePicture: 'guild.png',
    npub: 'npub-guild',
  });
  assert.deepEqual(resolvedOnlineMeta, {
    username: 'OnlineUser',
    avatarColor: '#abcdef',
    profilePicture: 'online.png',
    npub: 'npub-online',
  });

  const unchangedConversation = {
    other_user_id: 'user-1',
    other_username: 'Guildmate',
    other_avatar_color: '#123456',
    other_profile_picture: 'guild.png',
    other_npub: 'npub-guild',
  };
  assert.equal(
    mergeSidebarDmConversationMeta({
      conversation: unchangedConversation,
      resolvedMeta: resolvedGuildMeta,
    }),
    unchangedConversation,
  );
});

test('sidebar model shapes incoming dm conversation fallbacks and room-management access', () => {
  assert.equal(canSidebarManageRooms({ myRank: { order: 0, permissions: {} } }), true);
  assert.equal(canSidebarManageRooms({ myRank: { order: 2, permissions: { manage_rooms: true } } }), true);
  assert.equal(canSidebarManageRooms({ myRank: { order: 2, permissions: { manage_rooms: false } } }), false);

  assert.deepEqual(
    buildSidebarIncomingDmConversation({
      message: {
        sender_id: 'user-2',
        sender_name: 'Alice',
        sender_color: '#40FF40',
        sender_picture: 'alice.png',
        sender_npub: 'npub-alice',
        dm_partner_id: 'user-1',
      },
      currentUserId: 'user-1',
    }),
    {
      otherUserId: 'user-2',
      fallback: {
        username: 'Alice',
        avatarColor: '#40FF40',
        profilePicture: 'alice.png',
        npub: 'npub-alice',
      },
    },
  );
});
