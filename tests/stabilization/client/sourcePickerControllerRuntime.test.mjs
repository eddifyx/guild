import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectMacVirtualAudioDevicesRuntime,
  loadDesktopSourcesControllerRuntime,
} from '../../../client/src/features/stream/sourcePickerControllerRuntime.mjs';

test('source picker controller runtime applies detected mac virtual audio state through injected setters', async () => {
  const calls = [];

  const result = await detectMacVirtualAudioDevicesRuntime({
    enumerateDevicesFn: async () => [
      { deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' },
    ],
    setVirtualDevicesFn: (value) => calls.push(['virtualDevices', value]),
    setSelectedAudioDeviceFn: (value) => calls.push(['selectedAudioDevice', value]),
    setAudioDetectedFn: (value) => calls.push(['audioDetected', value]),
    setIncludeAudioFn: (value) => calls.push(['includeAudio', value]),
  });

  assert.deepEqual(result, {
    virtualDevices: [
      { deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' },
    ],
    selectedAudioDevice: 'virt-1',
    audioDetected: true,
  });
  assert.deepEqual(calls, [
    ['virtualDevices', [{ deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' }]],
    ['selectedAudioDevice', 'virt-1'],
    ['audioDetected', true],
  ]);
});

test('source picker controller runtime disables include-audio when mac virtual devices are unavailable', async () => {
  const calls = [];

  const result = await detectMacVirtualAudioDevicesRuntime({
    enumerateDevicesFn: async () => [],
    setVirtualDevicesFn: (value) => calls.push(['virtualDevices', value]),
    setSelectedAudioDeviceFn: (value) => calls.push(['selectedAudioDevice', value]),
    setAudioDetectedFn: (value) => calls.push(['audioDetected', value]),
    setIncludeAudioFn: (value) => calls.push(['includeAudio', value]),
  });

  assert.deepEqual(result, {
    virtualDevices: [],
    selectedAudioDevice: '',
    audioDetected: false,
  });
  assert.deepEqual(calls, [
    ['virtualDevices', []],
    ['includeAudio', false],
  ]);
});

test('source picker controller runtime loads base sources and deferred mac windows/thumbnails', async () => {
  const loadingCalls = [];
  let currentSources = [];
  const thumbnailMapRef = { current: {} };

  const setSourcesFn = (value) => {
    currentSources = typeof value === 'function' ? value(currentSources) : value;
  };

  await loadDesktopSourcesControllerRuntime({
    isMac: true,
    getDesktopSourcesFn: async () => [{ id: 'screen:1', name: 'Screen 1', thumbnail: null }],
    getDesktopWindowsFn: async () => [{ id: 'window:1', name: 'Window 1', thumbnail: null }],
    getDesktopThumbnailsFn: async () => ({ 'window:1': 'thumb-1' }),
    setSourcesFn,
    setLoadingFn: (value) => loadingCalls.push(value),
    thumbnailMapRef,
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(loadingCalls, [false]);
  assert.deepEqual(currentSources, [
    { id: 'screen:1', name: 'Screen 1', thumbnail: null },
    { id: 'window:1', name: 'Window 1', thumbnail: 'thumb-1' },
  ]);
  assert.deepEqual(thumbnailMapRef.current, {
    'window:1': 'thumb-1',
  });
});

test('source picker controller runtime clears loading when the initial desktop source fetch fails', async () => {
  const loadingCalls = [];

  const result = await loadDesktopSourcesControllerRuntime({
    getDesktopSourcesFn: async () => {
      throw new Error('no desktop bridge');
    },
    setLoadingFn: (value) => loadingCalls.push(value),
  });

  assert.equal(result, null);
  assert.deepEqual(loadingCalls, [false]);
});
