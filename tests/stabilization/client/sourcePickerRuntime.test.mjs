import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDesktopSourceThumbnails,
  mergeDesktopWindowSources,
  resolveMacVirtualAudioState,
} from '../../../client/src/features/stream/sourcePickerRuntime.mjs';

test('source picker runtime resolves the mac virtual audio state from enumerated devices', () => {
  assert.deepEqual(resolveMacVirtualAudioState([
    { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Mic' },
    { deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' },
  ]), {
    virtualDevices: [
      { deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' },
    ],
    selectedAudioDevice: 'virt-1',
    audioDetected: true,
  });

  assert.deepEqual(resolveMacVirtualAudioState([]), {
    virtualDevices: [],
    selectedAudioDevice: '',
    audioDetected: false,
  });
});

test('source picker runtime merges desktop windows without duplicating existing sources', () => {
  assert.deepEqual(mergeDesktopWindowSources({
    currentSources: [
      { id: 'screen:1', name: 'Screen 1', thumbnail: null },
      { id: 'window:1', name: 'Window 1', thumbnail: 'old-thumb' },
    ],
    windows: [
      { id: 'window:1', name: 'Window 1', thumbnail: 'new-thumb' },
      { id: 'window:2', name: 'Window 2', thumbnail: null },
    ],
    thumbnailMap: {
      'window:2': 'thumb-2',
    },
  }), [
    { id: 'screen:1', name: 'Screen 1', thumbnail: null },
    { id: 'window:1', name: 'Window 1', thumbnail: 'old-thumb' },
    { id: 'window:2', name: 'Window 2', thumbnail: 'thumb-2' },
  ]);
});

test('source picker runtime applies background thumbnails without losing existing source data', () => {
  assert.deepEqual(applyDesktopSourceThumbnails({
    currentSources: [
      { id: 'screen:1', name: 'Screen 1', thumbnail: null },
      { id: 'window:1', name: 'Window 1', thumbnail: 'old-thumb' },
    ],
    thumbnails: {
      'screen:1': 'screen-thumb',
      'window:1': 'window-thumb',
    },
    thumbnailMap: {
      'window:2': 'window-2-thumb',
    },
  }), {
    thumbnailMap: {
      'window:2': 'window-2-thumb',
      'screen:1': 'screen-thumb',
      'window:1': 'window-thumb',
    },
    sources: [
      { id: 'screen:1', name: 'Screen 1', thumbnail: 'screen-thumb' },
      { id: 'window:1', name: 'Window 1', thumbnail: 'window-thumb' },
    ],
  });
});
