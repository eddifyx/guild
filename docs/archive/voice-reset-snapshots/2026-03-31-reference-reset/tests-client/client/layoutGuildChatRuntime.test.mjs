import test from 'node:test';
import assert from 'node:assert/strict';

import {
  focusGuildChatComposer,
  queueGuildChatComposerFocus,
  scheduleInitialGuildChatComposerFocus,
  syncGuildChatDockState,
  syncGuildChatExpandedState,
  syncStreamImmersiveState,
} from '../../../client/src/features/layout/layoutGuildChatRuntime.mjs';

function createWindowStub() {
  const dispatched = [];
  const timers = [];
  return {
    dispatched,
    timers,
    requestAnimationFrame(handler) {
      handler();
    },
    dispatchEvent(event) {
      dispatched.push(event.type);
    },
    setTimeout(handler, delay) {
      timers.push({ handler, delay });
      return `${delay}`;
    },
    clearTimeout() {},
  };
}

test('layout guild chat runtime focuses and queues composer focus events through the window bridge', () => {
  const windowStub = createWindowStub();
  assert.equal(focusGuildChatComposer({ windowObj: windowStub }), true);
  assert.deepEqual(windowStub.dispatched, ['guildchat:focus-composer']);

  const queued = [];
  queueGuildChatComposerFocus({
    windowObj: windowStub,
    focusGuildChatComposerFn: () => queued.push('focused'),
  });
  assert.deepEqual(windowStub.timers.map((entry) => entry.delay), [0, 90, 220]);
  windowStub.timers.forEach((entry) => entry.handler());
  assert.equal(queued.length, 3);
});

test('layout guild chat runtime resets compact state, stream immersive state, and expanded visibility', () => {
  const compactValues = [];
  const expandedValues = [];
  const immersiveValues = [];
  const focusRef = { current: true };

  assert.equal(syncGuildChatDockState({
    conversation: { type: 'room', id: 'room-1' },
    setGuildChatCompactFn: (value) => compactValues.push(value),
    guildChatInitialFocusAppliedRef: focusRef,
  }), true);
  assert.deepEqual(compactValues, [false]);
  assert.equal(focusRef.current, false);

  assert.equal(syncStreamImmersiveState({
    conversationType: 'room',
    streamImmersive: true,
    setStreamImmersiveFn: (value) => immersiveValues.push(value),
  }), true);
  assert.deepEqual(immersiveValues, [false]);

  assert.equal(syncGuildChatExpandedState({
    guildChatAvailable: false,
    guildChatExpanded: true,
    setGuildChatExpandedFn: (value) => expandedValues.push(value),
  }), true);
  assert.deepEqual(expandedValues, [false]);
});

test('layout guild chat runtime schedules initial composer focus only when the dock is eligible', () => {
  const windowStub = createWindowStub();
  const documentStub = { activeElement: null };
  const focusRef = { current: false };
  const focused = [];

  const cleanup = scheduleInitialGuildChatComposerFocus({
    showGuildChatDock: true,
    conversation: null,
    currentGuildData: { id: 'guild-1' },
    guildChatInitialFocusAppliedRef: focusRef,
    documentObj: documentStub,
    windowObj: windowStub,
    focusGuildChatComposerFn: () => focused.push('focus'),
  });

  assert.equal(focusRef.current, true);
  assert.deepEqual(windowStub.timers.map((entry) => entry.delay), [0, 140, 420]);
  windowStub.timers.forEach((entry) => entry.handler());
  assert.equal(focused.length, 3);
  cleanup();
});
