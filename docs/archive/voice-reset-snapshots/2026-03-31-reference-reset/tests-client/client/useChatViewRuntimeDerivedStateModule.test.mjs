import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates conversation bootstrap derivation to a dedicated derived-state hook', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const derivedStateSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntimeDerivedState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useChatViewRuntimeDerivedState\.mjs'/);
  assert.match(runtimeSource, /useChatViewRuntimeDerivedState\(/);
  assert.doesNotMatch(runtimeSource, /isConversationDmSupported\(/);
  assert.doesNotMatch(runtimeSource, /getEffectiveConversation\(/);
  assert.doesNotMatch(runtimeSource, /getChatViewTrustBootstrapState\(/);

  assert.match(derivedStateSource, /function useChatViewRuntimeDerivedState\(/);
  assert.match(derivedStateSource, /isConversationDmSupported\(/);
  assert.match(derivedStateSource, /getEffectiveConversation\(/);
  assert.match(derivedStateSource, /getChatViewTrustBootstrapState\(/);
  assert.match(derivedStateSource, /useMemo\(/);
});
