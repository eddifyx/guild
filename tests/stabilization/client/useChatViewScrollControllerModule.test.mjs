import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates scroll choreography to a dedicated scroll controller hook', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const scrollControllerSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewScrollController.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useChatViewScrollController\.mjs'/);
  assert.match(runtimeSource, /useChatViewScrollController\(/);
  assert.doesNotMatch(runtimeSource, /const scrollToBottom = useCallback\(/);
  assert.doesNotMatch(runtimeSource, /bindChatViewScrollRuntime\(/);
  assert.doesNotMatch(runtimeSource, /const scheduleInitialBottomRelease = useCallback\(/);

  assert.match(scrollControllerSource, /function useChatViewScrollController\(/);
  assert.match(scrollControllerSource, /buildChatViewScrollHandlerInput\(/);
  assert.match(scrollControllerSource, /buildChatViewScrollRuntimeInput\(/);
  assert.match(scrollControllerSource, /createChatViewScrollHandler\(/);
  assert.match(scrollControllerSource, /bindChatViewScrollRuntime\(/);
  assert.match(scrollControllerSource, /window\.setTimeout/);
  assert.match(scrollControllerSource, /window\.clearTimeout/);
});
