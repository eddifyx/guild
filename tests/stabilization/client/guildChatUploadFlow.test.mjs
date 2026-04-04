import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractGuildChatClipboardImages,
  handleGuildChatPasteUpload,
  handleGuildChatDragEnter,
  handleGuildChatDragOver,
  handleGuildChatDragLeave,
  handleGuildChatFileDrop,
  removeGuildChatPendingUpload,
} from '../../../client/src/features/messaging/guildChatUploadFlow.mjs';

test('guild chat upload flow extracts only clipboard images', () => {
  const clipboardFile = { name: 'pasted.png' };
  const event = {
    clipboardData: {
      items: [
        {
          type: 'image/png',
          getAsFile() {
            return clipboardFile;
          },
        },
        {
          type: 'text/plain',
          getAsFile() {
            return { name: 'note.txt' };
          },
        },
        {
          type: 'image/jpeg',
          getAsFile() {
            return null;
          },
        },
      ],
    },
  };

  assert.deepEqual(extractGuildChatClipboardImages(event), [clipboardFile]);
});

test('guild chat upload flow handles paste uploads only when clipboard images exist', async () => {
  const calls = [];
  const result = await handleGuildChatPasteUpload({
    event: {
      clipboardData: {
        items: [{
          type: 'image/png',
          getAsFile() {
            return { name: 'paste.png' };
          },
        }],
      },
      preventDefault() {
        calls.push('prevent');
      },
    },
    uploadPendingFilesFn: async (files, sourceLabel) => {
      calls.push({ files, sourceLabel });
    },
  });

  const noImageResult = await handleGuildChatPasteUpload({
    event: {
      clipboardData: {
        items: [{
          type: 'text/plain',
          getAsFile() {
            return { name: 'note.txt' };
          },
        }],
      },
      preventDefault() {
        calls.push('prevent-noop');
      },
    },
    uploadPendingFilesFn: async () => {
      calls.push('upload-noop');
    },
  });

  assert.equal(result, true);
  assert.equal(noImageResult, false);
  assert.deepEqual(calls, [
    'prevent',
    { files: [{ name: 'paste.png' }], sourceLabel: 'Paste' },
  ]);
});

test('guild chat upload flow manages drag state across enter over leave and drop', async () => {
  const dragDepthRef = { current: 0 };
  const dragStates = [];
  const uploaded = [];
  const eventBase = {
    preventDefault() {},
    stopPropagation() {},
    dataTransfer: {
      types: ['Files'],
      files: [{ name: 'drop.png' }],
      dropEffect: 'none',
    },
  };

  const enterHandled = handleGuildChatDragEnter({
    event: eventBase,
    dragDepthRef,
    setDragActiveFn: (value) => dragStates.push(value),
  });

  const overHandled = handleGuildChatDragOver({
    event: eventBase,
    dragActive: false,
    setDragActiveFn: (value) => dragStates.push(value),
  });

  const leaveHandled = handleGuildChatDragLeave({
    event: eventBase,
    dragDepthRef,
    setDragActiveFn: (value) => dragStates.push(value),
  });

  dragDepthRef.current = 1;
  const dropHandled = handleGuildChatFileDrop({
    event: eventBase,
    dragDepthRef,
    setDragActiveFn: (value) => dragStates.push(value),
    uploadPendingFilesFn: async (files, sourceLabel) => {
      uploaded.push({ files, sourceLabel });
    },
  });

  await Promise.resolve();

  assert.equal(enterHandled, true);
  assert.equal(overHandled, true);
  assert.equal(leaveHandled, true);
  assert.equal(dropHandled, true);
  assert.equal(eventBase.dataTransfer.dropEffect, 'copy');
  assert.equal(dragDepthRef.current, 0);
  assert.deepEqual(dragStates, [true, true, false, false]);
  assert.deepEqual(uploaded, [
    { files: [{ name: 'drop.png' }], sourceLabel: 'Drop' },
  ]);
});

test('guild chat upload flow removes pending files and revokes previews', async () => {
  const file = { id: 'pending-1' };
  let pendingFiles = [file, { id: 'pending-2' }];
  const calls = [];

  const result = await removeGuildChatPendingUpload({
    index: 0,
    pendingFilesRef: { current: pendingFiles },
    setPendingFilesFn: (updater) => {
      pendingFiles = updater(pendingFiles);
    },
    revokePreviewFn: (value) => calls.push(['revoke', value]),
    deleteChatAttachmentUploadFn: async (value) => {
      calls.push(['delete', value]);
    },
  });

  assert.equal(result, true);
  assert.deepEqual(pendingFiles, [{ id: 'pending-2' }]);
  assert.deepEqual(calls, [
    ['revoke', file],
    ['delete', file],
  ]);
});

test('guild chat upload flow warns and returns false when deleting a pending file fails', async () => {
  const warnings = [];
  const result = await removeGuildChatPendingUpload({
    index: 0,
    pendingFilesRef: { current: [{ id: 'pending-1' }] },
    setPendingFilesFn: () => {},
    revokePreviewFn: () => {},
    deleteChatAttachmentUploadFn: async () => {
      throw new Error('boom');
    },
    warnFn: (...args) => warnings.push(args),
  });

  assert.equal(result, false);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], '[GuildChat] Failed to delete pending upload:');
  assert.equal(warnings[0][1], 'boom');
});
