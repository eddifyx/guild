import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closeSidebarTracedModal,
  openSidebarTracedModal,
  readSidebarMutePreference,
  toggleSidebarMutePreference,
} from '../../../client/src/features/layout/sidebarControllerRuntime.mjs';

test('sidebar controller runtime reads mute preferences from storage', () => {
  assert.equal(readSidebarMutePreference({
    storage: {
      getItem: (key) => (key === 'notify:muteRooms' ? 'true' : null),
    },
    key: 'notify:muteRooms',
  }), true);

  assert.equal(readSidebarMutePreference({
    storage: {
      getItem: () => 'false',
    },
    key: 'notify:muteDMs',
  }), false);
});

test('sidebar controller runtime toggles mute preferences and persists the next value', () => {
  const writes = [];
  const next = toggleSidebarMutePreference({
    currentValue: false,
    storage: {
      setItem: (...args) => writes.push(args),
    },
    key: 'notify:muteDMs',
  });

  assert.equal(next, true);
  assert.deepEqual(writes, [['notify:muteDMs', 'true']]);
});

test('sidebar controller runtime opens and closes traced modals through shared helpers', () => {
  const traceIds = [];
  const visibility = [];

  const traceId = openSidebarTracedModal({
    traceName: 'audio-settings-open',
    startPerfTraceFn: (name, payload) => {
      traceIds.push([name, payload]);
      return 'trace-123';
    },
    setOpenTraceIdFn: (value) => traceIds.push(['id', value]),
    setVisibleFn: (value) => visibility.push(value),
  });

  assert.equal(traceId, 'trace-123');
  assert.deepEqual(traceIds[0], ['audio-settings-open', { surface: 'sidebar' }]);
  assert.deepEqual(traceIds[1], ['id', 'trace-123']);
  assert.deepEqual(visibility, [true]);

  closeSidebarTracedModal({
    setVisibleFn: (value) => visibility.push(value),
    setOpenTraceIdFn: (value) => traceIds.push(['close', value]),
  });

  assert.deepEqual(traceIds[2], ['close', null]);
  assert.deepEqual(visibility, [true, false]);
});
