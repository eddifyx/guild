import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates open-trace completion to a dedicated effect hook', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const openTraceSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewOpenTraceEffect.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useChatViewOpenTraceEffect\.mjs'/);
  assert.match(runtimeSource, /useChatViewOpenTraceEffect\(/);
  assert.doesNotMatch(runtimeSource, /endPerfTraceAfterNextPaint\(/);
  assert.doesNotMatch(runtimeSource, /completedOpenTraceIdsRef\.current\.add\(openTraceId\)/);

  assert.match(openTraceSource, /function useChatViewOpenTraceEffect\(/);
  assert.match(openTraceSource, /endPerfTraceAfterNextPaint/);
  assert.match(openTraceSource, /completedOpenTraceIdsRef\.current\.add\(openTraceId\)/);
  assert.match(openTraceSource, /surface: 'chat-view'/);
});
