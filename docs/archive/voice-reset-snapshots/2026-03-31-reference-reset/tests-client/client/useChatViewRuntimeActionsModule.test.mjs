import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates action composition to a dedicated actions hook', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntimeActions.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/useChatViewRuntimeActions\.mjs'/);
  assert.match(runtimeSource, /useChatViewRuntimeActions\(/);
  assert.doesNotMatch(runtimeSource, /createChatViewSendHandler\(/);
  assert.doesNotMatch(runtimeSource, /createTrustContactAction\(/);
  assert.doesNotMatch(runtimeSource, /createChatViewTrustUiHandlers\(/);

  assert.match(actionsSource, /function useChatViewRuntimeActions\(/);
  assert.match(actionsSource, /buildChatViewSendHandlerInput\(/);
  assert.match(actionsSource, /buildChatViewTrustActionInput\(/);
  assert.match(actionsSource, /buildChatViewTrustUiHandlersInput\(/);
  assert.match(actionsSource, /createChatViewSendHandler\(/);
  assert.match(actionsSource, /createTrustContactAction\(/);
  assert.match(actionsSource, /createChatViewTrustUiHandlers\(/);
});
