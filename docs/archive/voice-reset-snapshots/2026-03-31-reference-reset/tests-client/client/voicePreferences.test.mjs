import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyVoiceOutputDevice,
  applyVoiceOutputDeviceToAll,
  clampVoiceVolume,
  normalizeVoiceInputDeviceId,
  persistStoredMicGain,
  persistStoredUserVolume,
  readStoredMicGain,
  readStoredUserVolume,
  readStoredVoiceInputDeviceId,
  readStoredVoiceOutputDeviceId,
} from '../../../client/src/features/voice/voicePreferences.mjs';

function createMemoryStorage(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

test('voice preference readers normalize missing and malformed stored values', () => {
  const storage = createMemoryStorage({
    'voice:inputDeviceId': 'mic-1',
    'voice:outputDeviceId': 'speaker-9',
    'voice:micGain': '4.5',
    'voice:userVolume:user-2': '1.8',
    'voice:userVolume:user-3': 'not-a-number',
  });

  assert.equal(readStoredVoiceInputDeviceId(storage), 'mic-1');
  assert.equal(readStoredVoiceOutputDeviceId(storage), 'speaker-9');
  assert.equal(readStoredMicGain(storage), 4.5);
  assert.equal(readStoredUserVolume('user-2', storage), 1);
  assert.equal(readStoredUserVolume('user-3', storage), 1);
  assert.equal(readStoredUserVolume('user-4', storage), 1);
  assert.equal(clampVoiceVolume(-0.5), 0);
});

test('voice input device normalization treats literal default as the implicit default device', () => {
  const storage = createMemoryStorage({
    'voice:inputDeviceId': 'default',
  });

  assert.equal(normalizeVoiceInputDeviceId('default'), '');
  assert.equal(normalizeVoiceInputDeviceId(' mic-7 '), 'mic-7');
  assert.equal(readStoredVoiceInputDeviceId(storage), '');
});

test('voice preference writers persist normalized values', () => {
  const storage = createMemoryStorage();

  assert.equal(persistStoredMicGain(2.75, storage), 2.75);
  assert.equal(persistStoredUserVolume('user-7', 1.5, storage), 1);
  assert.equal(readStoredMicGain(storage), 2.75);
  assert.equal(readStoredUserVolume('user-7', storage), 1);
});

test('voice output device helpers apply sink ids with safe fallback behavior', async () => {
  const sinkIds = [];
  const audio = {
    async setSinkId(deviceId) {
      sinkIds.push(deviceId);
      if (deviceId === 'speaker-2') {
        throw new Error('unsupported');
      }
    },
  };

  const appliedDevice = await applyVoiceOutputDevice(audio, 'speaker-2');
  assert.equal(appliedDevice, 'default');
  assert.deepEqual(sinkIds, ['speaker-2', 'default']);

  const bulkCalls = [];
  const audioA = { setSinkId: async (deviceId) => { bulkCalls.push(['a', deviceId]); } };
  const audioB = { setSinkId: async (deviceId) => { bulkCalls.push(['b', deviceId]); } };
  assert.equal(applyVoiceOutputDeviceToAll([audioA, audioB], 'speaker-9'), 'speaker-9');
  await Promise.resolve();
  assert.deepEqual(bulkCalls, [['a', 'speaker-9'], ['b', 'speaker-9']]);
});
