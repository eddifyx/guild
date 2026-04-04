import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('guild chat dock controller delegates access, mention, and live-entry derivation to a dedicated view-state hook', async () => {
  const viewStateSource = await readFile(
    new URL('../../../client/src/features/messaging/useGuildChatDockControllerViewState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(viewStateSource, /function useGuildChatDockControllerViewState\(/);
  assert.match(viewStateSource, /buildGuildChatComposerAccess\(/);
  assert.match(viewStateSource, /findGuildMentionSuggestions\(/);
  assert.match(viewStateSource, /normalizeGuildChatMentionSelectionIndex\(/);
  assert.match(viewStateSource, /buildGuildChatLiveEntries\(/);
  assert.match(viewStateSource, /buildGuildChatSendState\(/);
});
