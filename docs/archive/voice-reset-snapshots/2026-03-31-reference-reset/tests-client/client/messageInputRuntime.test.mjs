import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearMessageInputDragState,
  createMessageInputAttachmentUploader,
  createMessageInputDragHandlers,
  createMessageInputSendHandler,
  createPendingFileRemovalHandler,
  emitMessageInputTyping,
  restoreFailedSendDraft,
} from '../../../client/src/features/messaging/messageInputRuntime.mjs';

function createStateSetter(state, key) {
  return (value) => {
    state[key] = typeof value === 'function' ? value(state[key]) : value;
  };
}

test('message input runtime emits typing events for the active conversation', () => {
  const calls = [];
  const socket = {
    emit(event, payload) {
      calls.push([event, payload]);
    },
  };

  emitMessageInputTyping({
    socket,
    conversation: { id: 'room-1', type: 'room' },
    start: true,
  });
  emitMessageInputTyping({
    socket,
    conversation: { id: 'user-2', type: 'dm' },
    start: false,
  });
  emitMessageInputTyping({
    socket: null,
    conversation: { id: 'room-1', type: 'room' },
    start: true,
  });

  assert.deepEqual(calls, [
    ['typing:start', { roomId: 'room-1', toUserId: null }],
    ['typing:stop', { roomId: null, toUserId: 'user-2' }],
  ]);
});

test('message input attachment uploader appends encrypted uploads and clears stale errors', async () => {
  const state = {
    uploading: false,
    pendingFiles: [{ id: 'existing' }],
    inputError: 'stale',
  };

  const uploadPendingAttachments = createMessageInputAttachmentUploader({
    getUploading: () => state.uploading,
    setUploadingFn: createStateSetter(state, 'uploading'),
    setInputErrorFn: createStateSetter(state, 'inputError'),
    setPendingFilesFn: createStateSetter(state, 'pendingFiles'),
    uploadAttachmentFn: async (file) => ({ id: file.name }),
  });

  const result = await uploadPendingAttachments([{ name: 'one.png' }, { name: 'two.png' }], 'Drop');

  assert.deepEqual(result, [{ id: 'one.png' }, { id: 'two.png' }]);
  assert.equal(state.uploading, false);
  assert.equal(state.inputError, '');
  assert.deepEqual(state.pendingFiles, [
    { id: 'existing' },
    { id: 'one.png' },
    { id: 'two.png' },
  ]);
});

test('message input attachment uploader reports upload failures without mutating pending files', async () => {
  const state = {
    uploading: false,
    pendingFiles: [{ id: 'existing' }],
    inputError: '',
  };
  const logs = [];

  const uploadPendingAttachments = createMessageInputAttachmentUploader({
    getUploading: () => state.uploading,
    setUploadingFn: createStateSetter(state, 'uploading'),
    setInputErrorFn: createStateSetter(state, 'inputError'),
    setPendingFilesFn: createStateSetter(state, 'pendingFiles'),
    uploadAttachmentFn: async () => {
      throw new Error('Upload exploded');
    },
    logErrorFn: (...args) => logs.push(args),
  });

  const result = await uploadPendingAttachments([{ name: 'one.png' }], 'Paste');

  assert.deepEqual(result, []);
  assert.equal(state.uploading, false);
  assert.equal(state.inputError, 'Upload exploded');
  assert.deepEqual(state.pendingFiles, [{ id: 'existing' }]);
  assert.deepEqual(logs, [['Paste upload failed:', new Error('Upload exploded')]]);
});

test('message input send handler clears the draft and forwards the encrypted payload', async () => {
  const state = {
    sending: false,
    text: '  hello  ',
    pendingFiles: [{ id: 'file-1' }],
    inputError: 'old',
  };
  const pendingFilesRef = { current: state.pendingFiles };
  const typingRef = { current: true };
  const typingTimeoutRef = { current: 42 };
  const sends = [];
  const typingEvents = [];
  const clearedTimeouts = [];
  let focusCalls = 0;

  const handleSend = createMessageInputSendHandler({
    getSending: () => state.sending,
    setSendingFn: createStateSetter(state, 'sending'),
    getText: () => state.text,
    getPendingFiles: () => pendingFilesRef.current,
    setInputErrorFn: createStateSetter(state, 'inputError'),
    setTextFn: createStateSetter(state, 'text'),
    pendingFilesRef,
    setPendingFilesFn: createStateSetter(state, 'pendingFiles'),
    typingRef,
    typingTimeoutRef,
    emitTypingFn: (start) => typingEvents.push(start),
    clearTimeoutFn: (value) => clearedTimeouts.push(value),
    requestAnimationFrameFn: (callback) => callback(),
    focusFn: () => {
      focusCalls += 1;
    },
    onSend: async (...args) => {
      sends.push(args);
    },
  });

  await handleSend();

  assert.deepEqual(sends, [['hello', [{ id: 'file-1' }]]]);
  assert.equal(state.sending, false);
  assert.equal(state.text, '');
  assert.deepEqual(state.pendingFiles, []);
  assert.deepEqual(pendingFilesRef.current, []);
  assert.equal(state.inputError, '');
  assert.equal(typingRef.current, false);
  assert.deepEqual(typingEvents, [false]);
  assert.deepEqual(clearedTimeouts, [42]);
  assert.equal(focusCalls, 1);
});

test('message input send handler restores the draft when secure send fails', async () => {
  const state = {
    sending: false,
    text: 'hello',
    pendingFiles: [{ id: 'file-1' }],
    inputError: '',
  };
  const pendingFilesRef = { current: state.pendingFiles };
  const typingRef = { current: true };
  const typingTimeoutRef = { current: 17 };
  let focusCalls = 0;

  const handleSend = createMessageInputSendHandler({
    getSending: () => state.sending,
    setSendingFn: createStateSetter(state, 'sending'),
    getText: () => state.text,
    getPendingFiles: () => pendingFilesRef.current,
    setInputErrorFn: createStateSetter(state, 'inputError'),
    setTextFn: createStateSetter(state, 'text'),
    pendingFilesRef,
    setPendingFilesFn: createStateSetter(state, 'pendingFiles'),
    typingRef,
    typingTimeoutRef,
    emitTypingFn: () => {},
    clearTimeoutFn: () => {},
    requestAnimationFrameFn: (callback) => callback(),
    focusFn: () => {
      focusCalls += 1;
    },
    onSend: async () => {
      throw new Error('Secure send failed hard');
    },
  });

  await handleSend();

  assert.equal(state.sending, false);
  assert.equal(state.text, 'hello');
  assert.deepEqual(state.pendingFiles, [{ id: 'file-1' }]);
  assert.deepEqual(pendingFilesRef.current, [{ id: 'file-1' }]);
  assert.equal(state.inputError, 'Secure send failed hard');
  assert.equal(focusCalls, 2);
});

test('message input pending-file removal revokes previews and tolerates delete failures', async () => {
  const state = {
    pendingFiles: [
      { id: 'file-1', _previewUrl: 'blob:one' },
      { id: 'file-2', _previewUrl: 'blob:two' },
    ],
  };
  const revoked = [];
  const warnings = [];

  const removePendingFile = createPendingFileRemovalHandler({
    getPendingFiles: () => state.pendingFiles,
    setPendingFilesFn: createStateSetter(state, 'pendingFiles'),
    revokePreviewFn: (file) => revoked.push(file?._previewUrl || null),
    deleteUploadFn: async () => {
      throw new Error('delete failed');
    },
    warnFn: (...args) => warnings.push(args),
  });

  await removePendingFile(0);

  assert.deepEqual(state.pendingFiles, [{ id: 'file-2', _previewUrl: 'blob:two' }]);
  assert.deepEqual(revoked, ['blob:one']);
  assert.deepEqual(warnings, [['Failed to delete pending upload:', 'delete failed']]);
});

test('message input drag handlers activate only for file drags and clear state on drop', async () => {
  const state = { dragActive: false };
  const dragDepthRef = { current: 0 };
  const uploads = [];

  const dragHandlers = createMessageInputDragHandlers({
    getDragActive: () => state.dragActive,
    dragDepthRef,
    setDragActiveFn: createStateSetter(state, 'dragActive'),
    clearDragStateFn: () => clearMessageInputDragState({
      dragDepthRef,
      setDragActiveFn: createStateSetter(state, 'dragActive'),
    }),
    uploadPendingAttachmentsFn: async (files, sourceLabel) => {
      uploads.push([files, sourceLabel]);
    },
  });

  const createEvent = (files = []) => ({
    dataTransfer: {
      types: ['Files'],
      files,
      dropEffect: 'none',
    },
    preventDefault() {},
    stopPropagation() {},
  });

  dragHandlers.handleDragEnter(createEvent());
  assert.equal(state.dragActive, true);
  assert.equal(dragDepthRef.current, 1);

  const dragOverEvent = createEvent();
  dragHandlers.handleDragOver(dragOverEvent);
  assert.equal(dragOverEvent.dataTransfer.dropEffect, 'copy');

  await dragHandlers.handleDrop(createEvent([{ name: 'drop.png' }]));
  assert.equal(state.dragActive, false);
  assert.equal(dragDepthRef.current, 0);
  assert.deepEqual(uploads, [[[ { name: 'drop.png' } ], 'Drop']]);
});

test('message input runtime restores failed drafts through the shared helper', () => {
  const state = {
    text: '',
    pendingFiles: [],
    inputError: '',
  };
  const pendingFilesRef = { current: [] };
  let focused = false;

  restoreFailedSendDraft({
    draftText: 'draft text',
    draftFiles: [{ id: 'file-1' }],
    setTextFn: createStateSetter(state, 'text'),
    pendingFilesRef,
    setPendingFilesFn: createStateSetter(state, 'pendingFiles'),
    setInputErrorFn: createStateSetter(state, 'inputError'),
    focusFn: () => {
      focused = true;
    },
    error: new Error('Retry me'),
  });

  assert.equal(state.text, 'draft text');
  assert.deepEqual(state.pendingFiles, [{ id: 'file-1' }]);
  assert.deepEqual(pendingFilesRef.current, [{ id: 'file-1' }]);
  assert.equal(state.inputError, 'Retry me');
  assert.equal(focused, true);
});
