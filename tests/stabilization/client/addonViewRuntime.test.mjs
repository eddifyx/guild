import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAddonDeleteAction,
  createAddonDownloadAction,
  createAddonDropAction,
  createAddonUploadAction,
} from '../../../client/src/features/addons/addonViewRuntime.mjs';

test('addon view runtime uploads files and resets the composer state on success', async () => {
  const progress = [];
  const state = [];
  const upload = createAddonUploadAction({
    uploadAddonFn: async (_file, description, onProgress) => {
      assert.equal(description, 'hello');
      onProgress(55);
    },
    getDescriptionFn: () => ' hello ',
    setPendingFileFn: (value) => state.push(['pending', value]),
    setUploadingFn: (value) => state.push(['uploading', value]),
    setUploadProgressFn: (value) => progress.push(value),
    setUploadErrorFn: (value) => state.push(['error', value]),
    clearDescriptionFn: () => state.push(['clearDescription', true]),
    clearFileInputFn: () => state.push(['clearInput', true]),
  });

  await upload({ name: 'mod.zip', size: 10, type: 'application/zip' });

  assert.deepEqual(progress, [0, 55, 0]);
  assert.deepEqual(state[0], ['pending', { name: 'mod.zip', size: 10, type: 'application/zip' }]);
  assert.deepEqual(state.at(-1), ['uploading', false]);
});

test('addon view runtime surfaces upload errors and still clears pending state', async () => {
  const state = [];
  const upload = createAddonUploadAction({
    uploadAddonFn: async () => {
      throw new Error('boom');
    },
    setPendingFileFn: (value) => state.push(['pending', value]),
    setUploadingFn: (value) => state.push(['uploading', value]),
    setUploadProgressFn: () => {},
    setUploadErrorFn: (value) => state.push(['error', value]),
  });

  await upload({ name: 'mod.zip', size: 10, type: 'application/zip' });

  assert.deepEqual(state.at(-2), ['pending', null]);
  assert.deepEqual(state.at(-1), ['uploading', false]);
  assert.ok(state.some(([kind, value]) => kind === 'error' && value === 'boom'));
});

test('addon view runtime handles drop, download notices, and delete logging through shared helpers', async () => {
  const uploads = [];
  const drag = [];
  const timers = [];
  const notices = [];
  const logs = [];

  const drop = createAddonDropAction({
    handleUploadFn: async (file) => uploads.push(file.name),
    setDragOverFn: (value) => drag.push(value),
  });

  drop({
    preventDefault: () => drag.push('prevent'),
    dataTransfer: {
      files: [{ name: 'mod.zip' }],
    },
  });

  const timerRef = { current: 'old-timer' };
  const download = createAddonDownloadAction({
    triggerAddonDownloadFn: ({ fileName, url }) => timers.push(['download', fileName, url]),
    timerRef,
    clearTimeoutFn: (value) => timers.push(['clear', value]),
    setTimeoutFn: (fn, delay) => {
      timers.push(['set', delay]);
      fn();
      return 'new-timer';
    },
    setDownloadNoticeFn: (value) => notices.push(value),
  });

  download('mod.zip', '/mods/mod.zip');

  const remove = createAddonDeleteAction({
    deleteAddonFn: async () => {
      throw new Error('nope');
    },
    logErrorFn: (...args) => logs.push(args),
  });

  await remove('addon-1');

  assert.deepEqual(uploads, ['mod.zip']);
  assert.deepEqual(drag, ['prevent', false]);
  assert.deepEqual(notices, ['mod.zip', null]);
  assert.deepEqual(timers, [
    ['download', 'mod.zip', '/mods/mod.zip'],
    ['clear', 'old-timer'],
    ['set', 3000],
  ]);
  assert.equal(timerRef.current, 'new-timer');
  assert.equal(logs.length, 1);
});
