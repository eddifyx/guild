import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearMainLayoutConversationPerfTrace,
  deriveMainLayoutConversationState,
  deriveMainLayoutLatestVersionState,
  updateMainLayoutConversationPerfTrace,
} from '../../../client/src/features/layout/mainLayoutControllerRuntimeUtils.mjs';

test('main layout controller runtime utils derive latest-version state canonically', () => {
  assert.deepEqual(
    deriveMainLayoutLatestVersionState({ version: '1.0.70', hasUpdate: true }),
    {
      latestVersionInfo: { version: '1.0.70', hasUpdate: true },
      updateAvailable: true,
    },
  );

  assert.deepEqual(
    deriveMainLayoutLatestVersionState(null),
    {
      latestVersionInfo: null,
      updateAvailable: false,
    },
  );
});

test('main layout controller runtime utils normalize conversation state updates through shared equality helpers', () => {
  const nextState = deriveMainLayoutConversationState({
    previousConversation: { type: 'room', id: 'room-1' },
    previousConversationName: 'Tavern',
    nextConversation: { type: 'room', id: 'room-1' },
    nextConversationName: 'Tavern',
    applyConversationStateFn: (prev, nextValue) => (prev.id === nextValue.id ? prev : nextValue),
    applyConversationNameFn: (prev, nextValue) => (prev === nextValue ? prev : nextValue),
  });

  assert.deepEqual(nextState, {
    conversation: { type: 'room', id: 'room-1' },
    conversationName: 'Tavern',
  });
});

test('main layout controller runtime utils supersede and clear perf traces through the shared cancel path', () => {
  const calls = [];

  const nextTraceId = updateMainLayoutConversationPerfTrace({
    currentTraceId: 'trace-1',
    nextTraceId: 'trace-2',
    cancelPerfTraceFn: (traceId, meta) => calls.push(['cancel', traceId, meta.reason]),
  });

  const clearedTraceId = clearMainLayoutConversationPerfTrace({
    currentTraceId: nextTraceId,
    reason: 'navigated-away',
    cancelPerfTraceFn: (traceId, meta) => calls.push(['clear', traceId, meta.reason]),
  });

  assert.equal(nextTraceId, 'trace-2');
  assert.equal(clearedTraceId, null);
  assert.deepEqual(calls, [
    ['cancel', 'trace-1', 'superseded'],
    ['clear', 'trace-2', 'navigated-away'],
  ]);
});
