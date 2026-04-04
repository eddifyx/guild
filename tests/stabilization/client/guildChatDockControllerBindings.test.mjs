import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGuildChatComposerKeyOptions,
  buildGuildChatDraftChangeOptions,
  buildGuildChatFileDropOptions,
  buildGuildChatMentionSelectionOptions,
  buildGuildChatPasteUploadOptions,
  buildGuildChatRemovePendingUploadOptions,
  buildGuildChatSendMessageOptions,
  buildGuildChatUploadPendingFilesOptions,
} from '../../../client/src/features/messaging/guildChatDockControllerBindings.mjs';

test('guild chat dock controller bindings preserve the draft and mention selection contracts', () => {
  const draftOptions = buildGuildChatDraftChangeOptions({
    nextValue: 'hello',
    localError: 'oops',
    typingActiveRef: { current: true },
  });
  const mentionOptions = buildGuildChatMentionSelectionOptions({
    suggestion: { userId: 'user-1' },
    draft: '@sc',
  });

  assert.equal(draftOptions.nextValue, 'hello');
  assert.equal(draftOptions.localError, 'oops');
  assert.equal(draftOptions.typingActiveRef.current, true);
  assert.equal(mentionOptions.suggestion.userId, 'user-1');
  assert.equal(mentionOptions.draft, '@sc');
});

test('guild chat dock controller bindings preserve upload and removal contracts', () => {
  const uploadOptions = buildGuildChatUploadPendingFilesOptions({
    files: [{ name: 'note.txt' }],
    sourceLabel: 'Paste',
    canCompose: true,
  });
  const pasteOptions = buildGuildChatPasteUploadOptions({
    event: { type: 'paste' },
  });
  const dropOptions = buildGuildChatFileDropOptions({
    event: { type: 'drop' },
    dragDepthRef: { current: 2 },
  });
  const removeOptions = buildGuildChatRemovePendingUploadOptions({
    index: 3,
    pendingFilesRef: { current: [{ id: 'file-1' }] },
  });

  assert.equal(uploadOptions.files[0].name, 'note.txt');
  assert.equal(uploadOptions.sourceLabel, 'Paste');
  assert.equal(uploadOptions.canCompose, true);
  assert.equal(pasteOptions.event.type, 'paste');
  assert.equal(dropOptions.event.type, 'drop');
  assert.equal(dropOptions.dragDepthRef.current, 2);
  assert.equal(removeOptions.index, 3);
  assert.equal(removeOptions.pendingFilesRef.current[0].id, 'file-1');
});

test('guild chat dock controller bindings preserve send and keydown contracts', () => {
  const sendOptions = buildGuildChatSendMessageOptions({
    draft: 'hello world',
    sending: true,
    canCompose: true,
  });
  const keyOptions = buildGuildChatComposerKeyOptions({
    mentionSuggestions: [{ userId: 'user-1' }],
    selectedMentionSuggestionIndex: 1,
  });

  assert.equal(sendOptions.draft, 'hello world');
  assert.equal(sendOptions.sending, true);
  assert.equal(sendOptions.canCompose, true);
  assert.equal(keyOptions.mentionSuggestions[0].userId, 'user-1');
  assert.equal(keyOptions.selectedMentionSuggestionIndex, 1);
});
