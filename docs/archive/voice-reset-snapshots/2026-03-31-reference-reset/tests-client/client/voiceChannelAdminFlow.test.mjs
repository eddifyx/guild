import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceChannelAdminHandlers,
  syncVoiceChannelAdminState,
} from '../../../client/src/features/voice/voiceChannelAdminFlow.mjs';

test('voice channel admin flow clears stale channel admin state when channels disappear', () => {
  const updates = [];
  syncVoiceChannelAdminState({
    voiceChannels: [{ id: 'keep' }],
    channelContextMenu: { channel: { id: 'gone' } },
    renameModal: { id: 'gone', name: 'Old Room' },
    deleteConfirm: { id: 'gone', name: 'Old Room' },
    setChannelContextMenuFn: (value) => updates.push(['menu', value]),
    setRenameModalFn: (value) => updates.push(['renameModal', value]),
    setRenameDraftFn: (value) => updates.push(['renameDraft', value]),
    setRenameErrorFn: (value) => updates.push(['renameError', value]),
    setDeleteConfirmFn: (value) => updates.push(['deleteConfirm', value]),
    setDeleteErrorFn: (value) => updates.push(['deleteError', value]),
  });

  assert.deepEqual(updates, [
    ['menu', null],
    ['renameModal', null],
    ['renameDraft', ''],
    ['renameError', ''],
    ['deleteConfirm', null],
    ['deleteError', ''],
  ]);
});

test('voice channel admin handlers manage context menus and rename flow consistently', async () => {
  const updates = [];
  const handlers = createVoiceChannelAdminHandlers({
    renameVoiceChannelFn: async (channelId, nextName) => {
      updates.push(['renameCall', channelId, nextName]);
    },
    setVolumeMenuFn: (value) => updates.push(['volumeMenu', value]),
    setChannelContextMenuFn: (value) => updates.push(['channelContextMenu', value]),
    setRenameModalFn: (value) => updates.push(['renameModal', value]),
    setRenameDraftFn: (value) => updates.push(['renameDraft', value]),
    setRenameErrorFn: (value) => updates.push(['renameError', value]),
    setRenamingFn: (value) => updates.push(['renaming', value]),
  });

  const event = {
    prevented: false,
    clientX: 10,
    clientY: 20,
    preventDefault() {
      this.prevented = true;
    },
  };
  handlers.openChannelContextMenu(event, { id: 'vc-1', name: 'Lounge' }, true);
  assert.equal(event.prevented, true);

  handlers.openRenameModal({ id: 'vc-1', name: 'Lounge' });
  handlers.closeRenameModal({ renaming: true });
  await handlers.submitRenameChannel({
    renameModal: { id: 'vc-1', name: 'Lounge' },
    renameDraft: ' Strategy ',
    renaming: false,
  });

  assert.deepEqual(updates, [
    ['volumeMenu', null],
    ['channelContextMenu', { x: 10, y: 20, channel: { id: 'vc-1', name: 'Lounge' } }],
    ['renameDraft', 'Lounge'],
    ['renameError', ''],
    ['renameModal', { id: 'vc-1', name: 'Lounge' }],
    ['channelContextMenu', null],
    ['renaming', true],
    ['renameCall', 'vc-1', 'Strategy'],
    ['renameModal', null],
    ['renameDraft', ''],
    ['renameError', ''],
    ['renaming', false],
  ]);
});

test('voice channel admin handlers surface delete and rename failures through shared error state', async () => {
  const updates = [];
  const handlers = createVoiceChannelAdminHandlers({
    renameVoiceChannelFn: async () => {
      throw new Error('rename-failed');
    },
    deleteVoiceChannelFn: async () => {
      throw new Error('delete-failed');
    },
    setRenameErrorFn: (value) => updates.push(['renameError', value]),
    setRenamingFn: (value) => updates.push(['renaming', value]),
    setDeleteErrorFn: (value) => updates.push(['deleteError', value]),
  });

  const renameResult = await handlers.submitRenameChannel({
    renameModal: { id: 'vc-2', name: 'War Room' },
    renameDraft: 'Ops',
    renaming: false,
  });
  const deleteResult = await handlers.submitDeleteChannel({ id: 'vc-2', name: 'War Room' });

  assert.equal(renameResult, false);
  assert.equal(deleteResult, false);
  assert.deepEqual(updates, [
    ['renaming', true],
    ['renameError', 'rename-failed'],
    ['renaming', false],
    ['deleteError', 'delete-failed'],
  ]);
});
