const test = require('node:test');
const assert = require('node:assert/strict');

const { ERROR_CODES } = require('../../../server/src/contracts/errorCodes');
const {
  buildGuildChatMessage,
  buildGuildMentionDirectory,
  extractGuildChatMentionsFromContent,
  getGuildChatPermissionFailure,
  listGuildChatMentionRecipients,
  mergeGuildChatMentions,
  resolveEffectiveGuildChatMentions,
  sanitizeGuildChatMentions,
} = require('../../../server/src/domain/messaging/guildChat');

const members = [
  { id: 'user-a', username: 'Alpha Wolf', npub: 'npub1alpha9999' },
  { id: 'user-b', username: 'Alpha Wolf', npub: 'npub1bravo1111' },
  { id: 'user-c', username: 'Builder' },
];

test('duplicate usernames receive stable suffixed guild mention tokens', () => {
  const directory = buildGuildMentionDirectory(members);
  const tokens = Array.from(directory.values()).map((entry) => entry.mentionToken).sort();

  assert.deepEqual(tokens, ['@Alpha·Wolf·1111', '@Alpha·Wolf·9999', '@Builder']);
});

test('extractGuildChatMentionsFromContent dedupes repeated mentions by user', () => {
  const content = 'hey @Builder and again @Builder and also @Alpha·Wolf·9999';
  const mentions = extractGuildChatMentionsFromContent(content, members);

  assert.deepEqual(
    mentions.map((mention) => mention.userId),
    ['user-c', 'user-a']
  );
});

test('mergeGuildChatMentions keeps first unique user mention only', () => {
  const merged = mergeGuildChatMentions(
    [{ userId: 'user-a', label: '@Alpha' }, { userId: 'user-b', label: '@Bravo' }],
    [{ userId: 'user-a', label: '@AlphaAgain' }, { userId: 'user-c', label: '@Charlie' }]
  );

  assert.deepEqual(
    merged.map((mention) => mention.userId),
    ['user-a', 'user-b', 'user-c']
  );
});

test('sanitizeGuildChatMentions removes non-members and malformed ranges', () => {
  const sanitized = sanitizeGuildChatMentions([
    { userId: 'user-a', label: '@Alpha', display: '@Alpha Wolf', start: 0, end: 6 },
    { userId: 'user-z', label: '@Ghost', display: '@Ghost', start: 7, end: 13 },
    { userId: 'user-c', label: '@Builder', display: '@Builder', start: 20, end: 18 },
  ], members);

  assert.deepEqual(sanitized, [
    { userId: 'user-a', label: '@Alpha', display: '@Alpha Wolf', start: 0, end: 6 },
    { userId: 'user-c', label: '@Builder', display: '@Builder', start: 20 },
  ]);
});

test('resolveEffectiveGuildChatMentions keeps only mentions present in content', () => {
  const resolution = resolveEffectiveGuildChatMentions({
    content: 'hello @Builder and @Alpha·Wolf·9999',
    requestedMentions: [
      { userId: 'user-a', label: '@Alpha·Wolf·9999' },
      { userId: 'user-b', label: '@Alpha·Wolf·1111' },
      { userId: 'user-c', label: '@Builder' },
    ],
    members,
  });

  assert.equal(resolution.ok, true);
  assert.equal(resolution.wasPruned, true);
  assert.deepEqual(
    resolution.effectiveMentions.map((mention) => mention.userId),
    ['user-c', 'user-a']
  );
});

test('buildGuildChatMessage strips runtime-only attachment fields and preserves mention payloads', () => {
  const message = buildGuildChatMessage({
    messageId: 'msg-1',
    guildId: 'guild-1',
    content: ' hello ',
    senderId: 'user-a',
    sender: {
      username: 'Alpha Wolf',
      avatar_color: '#40FF40',
      profile_picture: 'https://cdn.test/pfp.png',
      npub: 'npub1alpha9999',
    },
    mentions: [{ userId: 'user-c', label: '@Builder' }],
    attachments: [{
      id: 'upload-1',
      fileUrl: '/api/files/upload-1',
      _storedName: 'disk-name.bin',
    }],
  });

  assert.deepEqual(message, {
    id: 'msg-1',
    guildId: 'guild-1',
    content: 'hello',
    senderId: 'user-a',
    senderName: 'Alpha Wolf',
    senderColor: '#40FF40',
    senderPicture: 'https://cdn.test/pfp.png',
    senderNpub: 'npub1alpha9999',
    createdAt: message.createdAt,
    clientNonce: null,
    mentions: [{ userId: 'user-c', label: '@Builder' }],
    attachments: [{
      id: 'upload-1',
      fileUrl: '/api/files/upload-1',
    }],
  });
});

test('listGuildChatMentionRecipients excludes the sender from emitted mention targets', () => {
  const recipients = listGuildChatMentionRecipients([
    { userId: 'user-a' },
    { userId: 'user-c' },
    { userId: 'user-b' },
  ], 'user-a');

  assert.deepEqual(recipients, ['user-c', 'user-b']);
});

test('getGuildChatPermissionFailure returns stable guild membership and speak denial codes', () => {
  assert.deepEqual(getGuildChatPermissionFailure(null, 'guild_chat_listen'), {
    ok: false,
    code: ERROR_CODES.NOT_GUILD_MEMBER,
    error: 'Not a member of this guild',
  });

  const denied = getGuildChatPermissionFailure({
    rank_order: 4,
    permissions: {
      guild_chat_speak: true,
      guild_chat_listen: true,
      invite_member: false,
    },
    permission_overrides: {
      invite_member: false,
    },
  }, 'invite_member');

  assert.equal(denied.ok, false);
  assert.equal(denied.code, ERROR_CODES.GUILDCHAT_SPEAK_FORBIDDEN);
});
