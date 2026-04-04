import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cleanupGuildChatPendingUploads,
  focusGuildChatComposer,
  resetGuildChatDragStateWhenHidden,
  scrollGuildChatFeedToBottom,
  syncGuildChatComposerSelection,
  updateGuildChatStickToBottom,
} from '../../../client/src/features/messaging/guildChatDockRuntime.mjs';

test('guild chat dock runtime focuses the composer and restores caret selection', () => {
  let focused = false;
  let selection = null;
  const inputRef = {
    current: {
      value: 'hello',
      focus() {
        focused = true;
      },
      setSelectionRange(start, end) {
        selection = { start, end };
      },
    },
  };

  focusGuildChatComposer({
    inputRef,
    setComposerSelectionFn: (value) => {
      selection = value;
    },
    requestAnimationFrameFn: (callback) => callback(),
  });

  assert.equal(focused, true);
  assert.deepEqual(selection, { start: 5, end: 5 });
});

test('guild chat dock runtime syncs composer selection from events and refs', () => {
  let selection = null;
  const input = {
    value: 'builder',
    selectionStart: 2,
    selectionEnd: 5,
  };

  const result = syncGuildChatComposerSelection({
    eventOrInput: { target: input },
    setComposerSelectionFn: (value) => {
      selection = value;
    },
  });

  assert.deepEqual(result, { start: 2, end: 5 });
  assert.deepEqual(selection, { start: 2, end: 5 });
});

test('guild chat dock runtime updates scroll stickiness and resets drag state when hidden', () => {
  const feedRef = {
    current: {
      scrollHeight: 100,
      scrollTop: 50,
      clientHeight: 40,
    },
  };
  const stickToBottomRef = { current: false };
  const dragDepthRef = { current: 3 };
  const dragStates = [];

  assert.equal(updateGuildChatStickToBottom({ feedRef, stickToBottomRef }), true);
  assert.equal(stickToBottomRef.current, true);

  feedRef.current.scrollTop = 10;
  assert.equal(updateGuildChatStickToBottom({ feedRef, stickToBottomRef }), false);
  assert.equal(stickToBottomRef.current, false);

  assert.equal(
    resetGuildChatDragStateWhenHidden({
      hidden: true,
      dragActive: true,
      dragDepthRef,
      setDragActiveFn: (value) => dragStates.push(value),
    }),
    true
  );
  assert.equal(dragDepthRef.current, 0);
  assert.deepEqual(dragStates, [false]);
});

test('guild chat dock runtime scrolls to bottom and cleans up pending uploads', async () => {
  const feedRef = {
    current: {
      scrollTop: 0,
      scrollHeight: 180,
    },
  };
  const stickToBottomRef = { current: false };
  const cleaned = [];

  assert.equal(scrollGuildChatFeedToBottom({ feedRef, stickToBottomRef }), true);
  assert.equal(feedRef.current.scrollTop, 180);
  assert.equal(stickToBottomRef.current, true);

  const count = cleanupGuildChatPendingUploads({
    pendingFilesRef: { current: [{ id: 'f1' }, { id: 'f2' }] },
    revokePendingPreviewFn: (file) => cleaned.push(['revoke', file.id]),
    deleteChatAttachmentUploadFn: async (file) => {
      cleaned.push(['delete', file.id]);
    },
  });

  await Promise.resolve();

  assert.equal(count, 2);
  assert.deepEqual(cleaned, [
    ['revoke', 'f1'],
    ['delete', 'f1'],
    ['revoke', 'f2'],
    ['delete', 'f2'],
  ]);
});
