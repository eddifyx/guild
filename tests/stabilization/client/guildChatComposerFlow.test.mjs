import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGuildChatDraftInput,
  applyGuildChatMentionSelection,
  handleGuildChatComposerKeyEvent,
  sendGuildChatComposerMessage,
  uploadGuildChatPendingFiles,
  validateGuildChatAttachment,
  GUILD_CHAT_FILE_LIMIT_MESSAGE,
} from '../../../client/src/features/messaging/guildChatComposerFlow.mjs';

test('guild chat composer flow validates upload size with the shared limit message', () => {
  assert.equal(validateGuildChatAttachment(null), 'File upload failed.');
  assert.equal(validateGuildChatAttachment({ size: 30 * 1024 * 1024 }), GUILD_CHAT_FILE_LIMIT_MESSAGE);
  assert.equal(validateGuildChatAttachment({ size: 1024 }), null);
});

test('guild chat composer flow uploads valid attachments and surfaces the first failure', async () => {
  let localError = null;
  let pendingFiles = [];

  const result = await uploadGuildChatPendingFiles({
    files: [{ name: 'ok.png', size: 100 }, { name: 'too-big.bin', size: 30 * 1024 * 1024 }],
    canCompose: true,
    setLocalErrorFn: (value) => {
      localError = value;
    },
    setPendingFilesFn: (updater) => {
      pendingFiles = updater(pendingFiles);
    },
    uploadChatAttachmentFn: async (file) => ({ id: file.name }),
  });

  assert.deepEqual(result.uploaded, [{ id: 'ok.png' }]);
  assert.deepEqual(pendingFiles, [{ id: 'ok.png' }]);
  assert.equal(localError, GUILD_CHAT_FILE_LIMIT_MESSAGE);
});

test('guild chat composer flow updates typing state and stops typing when the draft clears', () => {
  let draft = '';
  let localError = 'old';
  const typingActiveRef = { current: false };
  const typingTimeoutRef = { current: null };
  const calls = [];

  const becameActive = applyGuildChatDraftInput({
    nextValue: 'hello',
    localError,
    setDraftFn: (value) => {
      draft = value;
    },
    syncComposerSelectionFn: () => {
      calls.push('selection');
    },
    setLocalErrorFn: (value) => {
      localError = value;
    },
    typingActiveRef,
    emitTypingFn: (value) => {
      calls.push(`typing:${value}`);
    },
    clearTypingTimerFn: () => {
      calls.push('clear');
    },
    typingTimeoutRef,
    stopTypingFn: () => {
      calls.push('stop');
    },
    setTimeoutFn: (callback) => {
      typingTimeoutRef.current = callback;
      return callback;
    },
    event: { target: { value: 'hello' } },
  });

  assert.equal(becameActive, true);
  assert.equal(draft, 'hello');
  assert.equal(localError, '');
  assert.equal(typingActiveRef.current, true);

  applyGuildChatDraftInput({
    nextValue: '   ',
    localError: '',
    setDraftFn: (value) => {
      draft = value;
    },
    syncComposerSelectionFn: () => {},
    setLocalErrorFn: () => {},
    typingActiveRef,
    emitTypingFn: () => {},
    clearTypingTimerFn: () => {},
    typingTimeoutRef,
    stopTypingFn: () => {
      calls.push('stop-empty');
    },
    event: { target: { value: '   ' } },
  });

  assert.equal(draft, '   ');
  assert.equal(calls.includes('typing:true'), true);
  assert.equal(calls.includes('stop-empty'), true);
});

test('guild chat composer flow applies a mention and restores draft/files when send fails', async () => {
  let draft = 'Hello @al';
  let selection = null;
  const inputRef = {
    current: {
      focus() {},
      setSelectionRange(start, end) {
        selection = { start, end };
      },
    },
  };

  const applied = applyGuildChatMentionSelection({
    suggestion: { mentionToken: '@alice' },
    activeMentionSearch: { replaceStart: 6, replaceEnd: 9 },
    draft,
    setDraftFn: (value) => {
      draft = value;
    },
    setSelectedMentionSuggestionIndexFn: () => {},
    inputRef,
    setComposerSelectionFn: (value) => {
      selection = value;
    },
    requestAnimationFrameFn: (callback) => callback(),
  });

  assert.equal(applied.nextDraft, 'Hello @alice ');
  assert.deepEqual(selection, { start: 13, end: 13 });

  const pendingFilesRef = { current: [{ id: 'file-1' }] };
  let sending = false;
  let pendingFiles = pendingFilesRef.current;

  const sent = await sendGuildChatComposerMessage({
    draft,
    sending,
    canCompose: true,
    pendingFilesRef,
    setLocalErrorFn: () => {},
    setSendingFn: (value) => {
      sending = value;
    },
    setDraftFn: (value) => {
      draft = typeof value === 'function' ? value(draft) : value;
    },
    setPendingFilesFn: (value) => {
      pendingFiles = typeof value === 'function' ? value(pendingFiles) : value;
    },
    stopTypingFn: () => {},
    sendMessageFn: async () => {
      throw new Error('send failed');
    },
    requestAnimationFrameFn: (callback) => callback(),
    focusInputFn: () => {},
  });

  assert.equal(sent, false);
  assert.equal(draft, 'Hello @alice ');
  assert.deepEqual(pendingFiles, [{ id: 'file-1' }]);
  assert.equal(sending, false);
});

test('guild chat composer flow handles mention navigation and send keyboard shortcuts', () => {
  const actions = [];

  const sendResult = handleGuildChatComposerKeyEvent({
    event: {
      key: 'Enter',
      shiftKey: false,
      preventDefault() {
        actions.push('prevent-send');
      },
    },
    mentionSuggestions: [],
    handleSendFn: () => {
      actions.push('send');
    },
  });

  const mentionResult = handleGuildChatComposerKeyEvent({
    event: {
      key: 'ArrowDown',
      preventDefault() {
        actions.push('prevent-mention');
      },
    },
    mentionSuggestions: [{ mentionToken: '@alice' }],
    selectedMentionSuggestionIndex: 0,
    setSelectedMentionSuggestionIndexFn: () => {
      actions.push('mention-next');
    },
  });

  assert.equal(sendResult, 'send');
  assert.equal(mentionResult, 'mention-next');
  assert.deepEqual(actions, ['prevent-send', 'send', 'prevent-mention', 'mention-next']);
});

test('guild chat composer flow applies the selected mention on Enter before sending', () => {
  const actions = [];

  const result = handleGuildChatComposerKeyEvent({
    event: {
      key: 'Enter',
      shiftKey: false,
      preventDefault() {
        actions.push('prevent-mention-apply');
      },
    },
    mentionSuggestions: [{ mentionToken: '@alice' }, { mentionToken: '@bob' }],
    selectedMentionSuggestionIndex: 1,
    applyMentionSuggestionFn: (suggestion) => {
      actions.push(['apply', suggestion.mentionToken]);
    },
    handleSendFn: () => {
      actions.push('send');
    },
  });

  assert.equal(result, 'mention-apply');
  assert.deepEqual(actions, [
    'prevent-mention-apply',
    ['apply', '@bob'],
  ]);
});
