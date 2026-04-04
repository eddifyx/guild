import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages controller runtime delegates support, action creation, and effects to dedicated owners', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesControllerRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /from '\.\/useMessagesControllerSupportRuntime\.mjs'/);
  assert.match(source, /from '\.\/useMessagesControllerActionRuntime\.mjs'/);
  assert.match(source, /from '\.\/useMessagesControllerEffectRuntime\.mjs'/);
  assert.match(source, /useMessagesControllerSupportRuntime\(/);
  assert.match(source, /useMessagesControllerActionRuntime\(/);
  assert.match(source, /useMessagesControllerEffectRuntime\(/);
  assert.doesNotMatch(source, /createMessageControllerActions\(/);
  assert.doesNotMatch(source, /useMessagesRuntimeEffects\(/);
  assert.doesNotMatch(source, /windowObject\.clearTimeout\(/);
});
