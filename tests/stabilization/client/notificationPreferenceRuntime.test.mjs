import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readNotificationMutePreferences,
  setGlobalNotificationsMuted,
} from '../../../client/src/features/messaging/notificationPreferenceRuntime.mjs';

function createStorage(seed = {}) {
  const state = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null;
    },
    setItem(key, value) {
      state.set(key, String(value));
    },
  };
}

test('notification preference runtime reads global mute from legacy DM and room flags', () => {
  const storage = createStorage({
    'notify:muteRooms': 'true',
    'notify:muteDMs': 'true',
  });

  assert.deepEqual(readNotificationMutePreferences(storage), {
    muteAll: true,
    muteRooms: true,
    muteDMs: true,
  });
});

test('notification preference runtime sets global mute across messaging notification flags', () => {
  const storage = createStorage();

  assert.deepEqual(setGlobalNotificationsMuted(true, storage), {
    muteAll: true,
    muteRooms: true,
    muteDMs: true,
  });

  assert.deepEqual(setGlobalNotificationsMuted(false, storage), {
    muteAll: false,
    muteRooms: false,
    muteDMs: false,
  });
});
