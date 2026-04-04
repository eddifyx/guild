import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildChatComposerAccess,
  buildGuildChatLiveEntries,
  buildGuildChatMentionSuggestionEntries,
  buildGuildChatPendingUploadEntries,
  buildGuildChatSendState,
  buildGuildChatTimestampSeparatorEntry,
  normalizeGuildChatMentionSelectionIndex,
  shouldInsertGuildChatTimestampSeparator,
  shouldContinueGuildChatMessage,
} from '../../../client/src/features/messaging/guildChatDockModel.mjs';

test('guild chat dock model derives canonical composer access states', () => {
  assert.deepEqual(
    buildGuildChatComposerAccess({ connected: false, canListen: true, canSpeak: true }),
    { composerDisabledReason: '/guildchat reconnecting...', canCompose: false }
  );

  assert.deepEqual(
    buildGuildChatComposerAccess({ connected: true, canListen: false, canSpeak: true }),
    { composerDisabledReason: 'You do not have permission to view /guildchat.', canCompose: false }
  );

  assert.deepEqual(
    buildGuildChatComposerAccess({ connected: true, canListen: true, canSpeak: true }),
    { composerDisabledReason: '', canCompose: true }
  );
});

test('guild chat dock model shapes live entries, send state, and message continuation consistently', () => {
  const motdEntry = { id: 'motd-1', type: 'motd' };
  const messages = [{ id: 'm1', senderName: 'Scout', type: 'message' }];

  assert.deepEqual(buildGuildChatLiveEntries({ motdEntry, messages }), [motdEntry, ...messages]);
  assert.deepEqual(buildGuildChatLiveEntries({ motdEntry: null, messages }), messages);

  assert.deepEqual(
    buildGuildChatSendState({ draft: ' hello ', pendingFiles: [], canCompose: true, sending: false }),
    { hasContent: true, canSend: true }
  );
  assert.deepEqual(
    buildGuildChatSendState({ draft: '   ', pendingFiles: [], canCompose: true, sending: false }),
    { hasContent: false, canSend: false }
  );

  assert.equal(
    shouldContinueGuildChatMessage(
      { senderName: 'Scout', type: 'message' },
      { senderName: 'Scout', type: 'message' }
    ),
    true
  );
  assert.equal(
    shouldContinueGuildChatMessage(
      { senderName: 'Scout', type: 'motd' },
      { senderName: 'Scout', type: 'message' }
    ),
    false
  );
  assert.equal(
    shouldContinueGuildChatMessage(
      { senderName: 'Scout', type: 'timestamp-separator' },
      { senderName: 'Scout', type: 'message' }
    ),
    false
  );
});

test('guild chat dock model inserts timestamp separators when consecutive messages are over an hour apart', () => {
  const messages = [
    {
      id: 'm1',
      type: 'message',
      senderName: 'Scout',
      createdAt: '2026-03-29T18:47:00Z',
    },
    {
      id: 'm2',
      type: 'message',
      senderName: 'Scout',
      createdAt: '2026-03-31T16:39:00Z',
    },
  ];

  assert.equal(
    shouldInsertGuildChatTimestampSeparator(messages[0], messages[1]),
    true
  );

  assert.deepEqual(
    buildGuildChatTimestampSeparatorEntry(messages[1], messages[0]),
    {
      id: 'guildchat-separator-m2',
      type: 'timestamp-separator',
      createdAt: '2026-03-31T16:39:00Z',
      previousCreatedAt: '2026-03-29T18:47:00Z',
    }
  );

  assert.deepEqual(
    buildGuildChatLiveEntries({ messages }),
    [
      messages[0],
      {
        id: 'guildchat-separator-m2',
        type: 'timestamp-separator',
        createdAt: '2026-03-31T16:39:00Z',
        previousCreatedAt: '2026-03-29T18:47:00Z',
      },
      messages[1],
    ]
  );
});

test('guild chat dock model keeps short-gap messages in the same visual block', () => {
  const messages = [
    {
      id: 'm1',
      type: 'message',
      senderName: 'Scout',
      createdAt: '2026-03-31T16:00:00Z',
    },
    {
      id: 'm2',
      type: 'message',
      senderName: 'Scout',
      createdAt: '2026-03-31T16:45:00Z',
    },
  ];

  assert.equal(
    shouldInsertGuildChatTimestampSeparator(messages[0], messages[1]),
    false
  );

  assert.deepEqual(
    buildGuildChatLiveEntries({ messages }),
    messages
  );

  assert.equal(
    shouldContinueGuildChatMessage(messages[0], messages[1]),
    true
  );
});

test('guild chat dock model normalizes mention selection indices safely', () => {
  const mentionSuggestions = [{ userId: 'a' }, { userId: 'b' }];

  assert.equal(
    normalizeGuildChatMentionSelectionIndex({ mentionSuggestions, selectedIndex: 1 }),
    1
  );
  assert.equal(
    normalizeGuildChatMentionSelectionIndex({ mentionSuggestions, selectedIndex: 4 }),
    0
  );
  assert.equal(
    normalizeGuildChatMentionSelectionIndex({ mentionSuggestions: [], selectedIndex: 1 }),
    0
  );
});

test('guild chat dock model shapes upload entries and mention suggestion view data', () => {
  assert.deepEqual(buildGuildChatPendingUploadEntries({
    pendingFiles: [
      {
        fileId: 'file-1',
        _originalName: 'banner.png',
        _originalType: 'image/png',
        _previewUrl: 'blob://preview',
      },
      {
        id: 'file-2',
        fileName: 'notes.pdf',
        fileType: 'application/pdf',
      },
    ],
  }), [
    {
      key: 'file-1',
      index: 0,
      name: 'banner.png',
      previewUrl: 'blob://preview',
      isImage: true,
    },
    {
      key: 'file-2',
      index: 1,
      name: 'notes.pdf',
      previewUrl: null,
      isImage: false,
    },
  ]);

  assert.deepEqual(buildGuildChatMentionSuggestionEntries({
    mentionSuggestions: [
      {
        userId: 'user-1',
        username: 'Scout',
        displayLabel: 'Scout',
        mentionToken: '@Scout',
      },
      {
        userId: 'user-2',
        username: 'Nova',
        displayLabel: 'Nova',
        mentionToken: '@Nova',
      },
    ],
    selectedMentionSuggestionIndex: 1,
    members: [
      { id: 'user-1', avatarColor: '#abc', profilePicture: 'https://cdn.example/scout.png' },
      { id: 'user-2', avatar_color: '#def', profile_picture: 'https://cdn.example/nova.png' },
    ],
  }), [
    {
      userId: 'user-1',
      username: 'Scout',
      displayLabel: 'Scout',
      mentionToken: '@Scout',
      selected: false,
      avatarColor: '#abc',
      profilePicture: 'https://cdn.example/scout.png',
    },
    {
      userId: 'user-2',
      username: 'Nova',
      displayLabel: 'Nova',
      mentionToken: '@Nova',
      selected: true,
      avatarColor: '#def',
      profilePicture: 'https://cdn.example/nova.png',
    },
  ]);
});
