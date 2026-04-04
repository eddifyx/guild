import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller effects own scroll, focus, typing, and runtime-effect choreography', async () => {
  const effectsSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerEffects.mjs', import.meta.url),
    'utf8'
  );

  assert.match(effectsSource, /function useGuildChatDockControllerEffects\(/);
  assert.match(effectsSource, /useGuildChatDockRuntimeEffects\(/);
  assert.match(effectsSource, /focusGuildChatComposer\(/);
  assert.match(effectsSource, /syncGuildChatComposerSelection\(/);
  assert.match(effectsSource, /scrollGuildChatFeedToBottom\(/);
  assert.match(effectsSource, /updateGuildChatStickToBottom\(/);
  assert.match(effectsSource, /revokeGuildChatPendingPreview/);
});
