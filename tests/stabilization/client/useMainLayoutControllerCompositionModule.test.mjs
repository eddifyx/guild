import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('main layout controller composition owns room, unread, guild-chat, runtime, effect, and view orchestration', async () => {
  const compositionSource = await readFile(
    new URL('../../../client/src/features/layout/useMainLayoutControllerComposition.mjs', import.meta.url),
    'utf8'
  );

  assert.match(compositionSource, /function useMainLayoutControllerComposition\(/);
  assert.match(compositionSource, /useMainLayoutControllerSupport\(/);
  assert.match(compositionSource, /useMainLayoutControllerRuntimeView\(/);
  assert.doesNotMatch(compositionSource, /useRooms\(/);
  assert.doesNotMatch(compositionSource, /useNotifications\(/);
  assert.doesNotMatch(compositionSource, /useUnreadDMs\(/);
  assert.doesNotMatch(compositionSource, /useUnreadRooms\(/);
  assert.doesNotMatch(compositionSource, /useGuildChat\(/);
  assert.doesNotMatch(compositionSource, /useMainLayoutControllerRuntime\(/);
  assert.doesNotMatch(compositionSource, /useMainLayoutControllerEffects\(/);
  assert.doesNotMatch(compositionSource, /useMainLayoutControllerViewState\(/);
  assert.doesNotMatch(compositionSource, /buildMainLayoutControllerRuntimeInput\(/);
});
