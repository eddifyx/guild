import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindComposerShortcut,
  bindE2EWarningEvents,
  bindRoomAutoJoin,
  bindRoomLifecycle,
  bindSystemNotificationActions,
  startVersionPolling,
  syncE2EWarningState,
  VERSION_CHECK_INTERVAL_MS,
} from '../../../client/src/features/layout/layoutShellRuntime.mjs';

function createWindowStub() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(eventName, handler) {
      listeners.set(eventName, handler);
    },
    removeEventListener(eventName, handler) {
      if (listeners.get(eventName) === handler) listeners.delete(eventName);
    },
  };
}

function createSocketStub(connected = false) {
  const handlers = new Map();
  const emitted = [];
  return {
    connected,
    handlers,
    emitted,
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    off(eventName, handler) {
      if (handlers.get(eventName) === handler) handlers.delete(eventName);
    },
    emit(eventName, payload) {
      emitted.push([eventName, payload]);
    },
  };
}

test('layout shell runtime binds e2e warning events and clears warning after recovery', () => {
  const windowStub = createWindowStub();
  const warnings = [];

  const cleanup = bindE2EWarningEvents({
    windowObj: windowStub,
    setE2eWarningFn: (value) => warnings.push(value),
    wasE2EExpectedFn: () => true,
  });

  windowStub.listeners.get('e2e-init-failed')?.();
  assert.deepEqual(warnings, [true, true]);
  assert.equal(syncE2EWarningState({
    e2eWarning: true,
    isE2EInitializedFn: () => true,
    setE2eWarningFn: (value) => warnings.push(value),
  }), true);
  assert.equal(warnings.at(-1), false);
  cleanup();
  assert.equal(windowStub.listeners.has('e2e-init-failed'), false);
});

test('layout shell runtime starts version polling and schedules refreshes', async () => {
  const versions = [];
  const intervals = [];

  const cleanup = startVersionPolling({
    getAppVersionFn: async () => '1.2.3',
    refreshLatestVersionInfoFn: async () => ({ hasUpdate: false }),
    setAppVersionFn: (value) => versions.push(value),
    setIntervalFn: (handler, delayMs) => {
      intervals.push(delayMs);
      return { handler, delayMs };
    },
    clearIntervalFn: (intervalId) => {
      intervals.push(intervalId.delayMs);
    },
  });

  await Promise.resolve();
  assert.deepEqual(versions, ['1.2.3']);
  assert.equal(intervals[0], VERSION_CHECK_INTERVAL_MS);
  cleanup();
  assert.equal(intervals[1], VERSION_CHECK_INTERVAL_MS);
});

test('layout shell runtime auto-joins rooms on connect and binds room lifecycle handlers', () => {
  const socket = createSocketStub(true);
  const roomCleanup = bindRoomAutoJoin({
    socket,
    myRooms: [{ id: 'room-1' }, { id: 'room-2' }],
  });

  assert.deepEqual(socket.emitted, [
    ['room:join', { roomId: 'room-1' }],
    ['room:join', { roomId: 'room-2' }],
  ]);
  roomCleanup();

  const lifecycleSocket = createSocketStub();
  const cleared = [];
  const names = [];
  const lifecycleCleanup = bindRoomLifecycle({
    socket: lifecycleSocket,
    conversation: { type: 'room', id: 'room-1' },
    clearConversationFn: () => cleared.push(true),
    setConversationNameFn: (name) => names.push(name),
  });

  lifecycleSocket.handlers.get('room:deleted')?.({ roomId: 'room-1' });
  lifecycleSocket.handlers.get('room:renamed')?.({ roomId: 'room-1', name: 'Renamed' });
  assert.equal(cleared.length, 1);
  assert.deepEqual(names, ['Renamed']);
  lifecycleCleanup();
});

test('layout shell runtime routes composer shortcuts and system notification subscriptions through helpers', () => {
  const windowStub = createWindowStub();
  const documentStub = {
    querySelector(selector) {
      if (selector === '[data-modal-root="true"]') return null;
      if (selector === '[data-primary-composer="chat"], [data-primary-composer="guildchat"]') {
        return { id: 'composer' };
      }
      return null;
    },
  };
  const focused = [];

  const cleanup = bindComposerShortcut({
    windowObj: windowStub,
    documentObj: documentStub,
    isTextEntryTargetFn: () => false,
    focusComposerFn: (composer) => focused.push(composer.id),
  });

  const prevented = [];
  windowStub.listeners.get('keydown')?.({
    key: 'Tab',
    defaultPrevented: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: {},
    preventDefault: () => prevented.push(true),
  });

  assert.deepEqual(prevented, [true]);
  assert.deepEqual(focused, ['composer']);
  cleanup();

  let notificationPayload = null;
  const unsubscribe = bindSystemNotificationActions({
    subscribeFn: (handler) => {
      handler({ type: 'guildchat' });
      return () => {
        notificationPayload = 'unsubscribed';
      };
    },
    handleNotificationActionFn: (payload) => {
      notificationPayload = payload.type;
    },
  });

  assert.equal(notificationPayload, 'guildchat');
  unsubscribe();
  assert.equal(notificationPayload, 'unsubscribed');
});
