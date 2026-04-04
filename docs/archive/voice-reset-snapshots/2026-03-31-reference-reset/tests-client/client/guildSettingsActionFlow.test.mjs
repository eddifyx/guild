import test from 'node:test';
import assert from 'node:assert/strict';

import { createGuildSettingsControllerActions } from '../../../client/src/features/guild/guildSettingsActionFlow.mjs';

test('guild settings action flow validates images and rotates preview urls safely', async () => {
  const flashes = [];
  const previewHistory = [];

  let preview = 'blob:old-preview';
  const setImagePreviewFn = (updater) => {
    preview = typeof updater === 'function' ? updater(preview) : updater;
    previewHistory.push(preview);
  };

  const actions = createGuildSettingsControllerActions({
    currentGuild: 'guild-1',
    flash: (message, isError) => flashes.push([message, isError]),
    deps: {
      uploadGuildImageFileFn: async () => ({ fileUrl: '/uploads/guild.png' }),
      createObjectUrlFn: () => 'blob:new-preview',
      revokeObjectUrlFn: (value) => flashes.push(['revoke', value]),
    },
    state: {
      setUploadingImageFn: () => {},
      setGuildImageFn: () => {},
      setImagePreviewFn,
    },
  });

  await actions.onImageSelect({
    target: {
      files: [{ name: 'banner.png', type: 'image/png', size: 1024 }],
    },
  });

  assert.deepEqual(flashes[0], ['revoke', 'blob:old-preview']);
  assert.deepEqual(previewHistory, ['blob:new-preview']);
});

test('guild settings action flow trims created rank names and clears the draft after success', async () => {
  const calls = [];

  const actions = createGuildSettingsControllerActions({
    currentGuild: 'guild-1',
    newRankName: '  Officer  ',
    flash: (message, isError) => calls.push(['flash', message, isError]),
    deps: {
      createRankFn: async (...args) => calls.push(['create', ...args]),
      loadRanksFn: async (...args) => calls.push(['load-ranks', ...args]),
    },
    state: {
      setNewRankNameFn: (value) => calls.push(['set-new-rank', value]),
    },
  });

  await actions.onCreateRank();

  assert.deepEqual(calls, [
    ['create', 'guild-1', { name: 'Officer', permissions: {} }],
    ['load-ranks', { force: true }],
    ['set-new-rank', ''],
    ['flash', 'Rank created', false],
  ]);
});

test('guild settings action flow clears the confirmation dialog before running the callback', () => {
  const calls = [];

  const actions = createGuildSettingsControllerActions({
    confirmDialog: {
      onConfirm: () => calls.push('confirmed'),
    },
    state: {
      setConfirmDialogFn: (value) => calls.push(['set-confirm', value]),
    },
  });

  actions.onAcceptConfirmDialog();

  assert.deepEqual(calls, [
    ['set-confirm', null],
    'confirmed',
  ]);
});
