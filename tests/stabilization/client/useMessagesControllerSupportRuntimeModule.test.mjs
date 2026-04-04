import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('messages controller support runtime owns deferred sender-key timeout cleanup', async () => {
  const source = await readFile(
    new URL('../../../client/src/features/messaging/useMessagesControllerSupportRuntime.mjs', import.meta.url),
    'utf8'
  );

  assert.match(source, /function useMessagesControllerSupportRuntime\(/);
  assert.match(source, /useCallback\(/);
  assert.match(source, /windowObject\.clearTimeout\(/);
  assert.doesNotMatch(source, /createMessageControllerActions\(/);
  assert.doesNotMatch(source, /useMessagesRuntimeEffects\(/);
});
