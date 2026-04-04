import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSourcePickerSelectionPayload,
  detectVirtualAudioDevices,
  splitDesktopSources,
} from '../../../client/src/features/stream/sourcePickerModel.mjs';

test('source picker model detects known virtual audio devices case-insensitively', () => {
  const devices = [
    { deviceId: 'mic-1', kind: 'audioinput', label: 'Built-in Microphone' },
    { deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' },
    { deviceId: 'virt-2', kind: 'audioinput', label: 'Loopback Audio' },
    { deviceId: 'speaker-1', kind: 'audiooutput', label: 'VB-Cable Output' },
  ];

  assert.deepEqual(detectVirtualAudioDevices(devices), [
    { deviceId: 'virt-1', kind: 'audioinput', label: 'BlackHole 2ch' },
    { deviceId: 'virt-2', kind: 'audioinput', label: 'Loopback Audio' },
  ]);
});

test('source picker model splits desktop sources into screens and windows', () => {
  assert.deepEqual(splitDesktopSources([
    { id: 'screen:1', name: 'Screen 1' },
    { id: 'window:1', name: 'Window 1' },
    { id: 'screen:2', name: 'Screen 2' },
  ]), {
    screens: [
      { id: 'screen:1', name: 'Screen 1' },
      { id: 'screen:2', name: 'Screen 2' },
    ],
    windows: [
      { id: 'window:1', name: 'Window 1' },
    ],
  });
});

test('source picker model shapes the screen-share selection payload consistently', () => {
  assert.equal(buildSourcePickerSelectionPayload({ selectedSourceId: '' }), null);
  assert.deepEqual(buildSourcePickerSelectionPayload({
    selectedSourceId: 'screen:1',
    includeAudio: true,
    isMac: true,
    audioDetected: true,
    selectedAudioDevice: 'virt-1',
  }), {
    sourceId: 'screen:1',
    includeAudio: true,
    macAudioDeviceId: 'virt-1',
  });
  assert.deepEqual(buildSourcePickerSelectionPayload({
    selectedSourceId: 'window:1',
    includeAudio: true,
    isMac: false,
    audioDetected: true,
    selectedAudioDevice: 'virt-1',
  }), {
    sourceId: 'window:1',
    includeAudio: true,
    macAudioDeviceId: null,
  });
});
