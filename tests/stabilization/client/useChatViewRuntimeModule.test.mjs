import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('chat view runtime delegates pure input shaping to the dedicated inputs module', async () => {
  const runtimeSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntime.mjs', import.meta.url),
    'utf8'
  );
  const inputsSource = await readFile(
    new URL('../../../client/src/features/messaging/chatViewRuntimeInputs.mjs', import.meta.url),
    'utf8'
  );
  const handlersSource = await readFile(
    new URL('../../../client/src/features/messaging/chatViewRuntimeHandlers.mjs', import.meta.url),
    'utf8'
  );
  const scrollControllerSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewScrollController.mjs', import.meta.url),
    'utf8'
  );
  const actionsSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntimeActions.mjs', import.meta.url),
    'utf8'
  );
  const openTraceSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewOpenTraceEffect.mjs', import.meta.url),
    'utf8'
  );
  const trustEffectsSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewTrustEffects.mjs', import.meta.url),
    'utf8'
  );
  const derivedStateSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntimeDerivedState.mjs', import.meta.url),
    'utf8'
  );
  const stateSource = await readFile(
    new URL('../../../client/src/features/messaging/useChatViewRuntimeState.mjs', import.meta.url),
    'utf8'
  );

  assert.match(runtimeSource, /from '\.\/chatViewRuntimeInputs\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useChatViewOpenTraceEffect\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useChatViewRuntimeDerivedState\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useChatViewRuntimeActions\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useChatViewScrollController\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useChatViewRuntimeState\.mjs'/);
  assert.match(runtimeSource, /from '\.\/useChatViewTrustEffects\.mjs'/);
  assert.match(runtimeSource, /buildChatViewRuntimeValue\(/);
  assert.match(runtimeSource, /useChatViewOpenTraceEffect\(/);
  assert.match(runtimeSource, /useChatViewRuntimeDerivedState\(/);
  assert.match(runtimeSource, /useChatViewRuntimeActions\(/);
  assert.match(runtimeSource, /useChatViewScrollController\(/);
  assert.match(runtimeSource, /useChatViewRuntimeState\(/);
  assert.match(runtimeSource, /useChatViewTrustEffects\(/);
  assert.doesNotMatch(runtimeSource, /const handleSend = useCallback\(async/);
  assert.doesNotMatch(runtimeSource, /const onTrustInputChange = useCallback\(\(value\)/);
  assert.match(inputsSource, /function buildChatViewIdentityVerificationInput\(/);
  assert.match(inputsSource, /function buildChatViewScrollHandlerInput\(/);
  assert.match(inputsSource, /function buildChatViewTrustActionInput\(/);
  assert.match(inputsSource, /function buildChatViewSendHandlerInput\(/);
  assert.match(inputsSource, /function buildChatViewTrustUiHandlersInput\(/);
  assert.match(inputsSource, /function buildChatViewScrollRuntimeInput\(/);
  assert.match(inputsSource, /function buildChatViewRuntimeValue\(/);
  assert.match(handlersSource, /function createChatViewScrollHandler\(/);
  assert.match(handlersSource, /function createChatViewSendHandler\(/);
  assert.match(handlersSource, /function createChatViewTrustUiHandlers\(/);
  assert.match(actionsSource, /function useChatViewRuntimeActions\(/);
  assert.match(openTraceSource, /function useChatViewOpenTraceEffect\(/);
  assert.match(scrollControllerSource, /function useChatViewScrollController\(/);
  assert.match(trustEffectsSource, /function useChatViewTrustEffects\(/);
  assert.match(derivedStateSource, /function useChatViewRuntimeDerivedState\(/);
  assert.match(stateSource, /function useChatViewRuntimeState\(/);
});
